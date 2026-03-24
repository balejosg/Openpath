# OpenPath DNS Module for Windows
# Manages Acrylic DNS Proxy configuration and service

# Import common functions
$modulePath = Split-Path $PSScriptRoot -Parent
Import-Module "$modulePath\lib\Common.psm1" -Force -ErrorAction SilentlyContinue

function Get-AcrylicPath {
    <#
    .SYNOPSIS
        Gets the Acrylic DNS Proxy installation path
    #>
    $defaultPath = "${env:ProgramFiles(x86)}\Acrylic DNS Proxy"
    
    try {
        $config = Get-OpenPathConfig
        if ($config.acrylicPath -and (Test-Path $config.acrylicPath)) {
            return $config.acrylicPath
        }
    }
    catch {
        # Config file doesn't exist or is invalid - fall through to default paths
        Write-Debug "Config not available: $_"
    }
    
    if (Test-Path $defaultPath) {
        return $defaultPath
    }
    
    # Try Program Files (64-bit)
    $altPath = "$env:ProgramFiles\Acrylic DNS Proxy"
    if (Test-Path $altPath) {
        return $altPath
    }
    
    return $null
}

function Test-AcrylicInstalled {
    <#
    .SYNOPSIS
        Checks if Acrylic DNS Proxy is installed
    #>
    $path = Get-AcrylicPath
    return ($null -ne $path -and (Test-Path "$path\AcrylicService.exe"))
}

function Install-AcrylicDNS {
    <#
    .SYNOPSIS
        Downloads and installs Acrylic DNS Proxy silently
    .PARAMETER Force
        Force reinstallation even if already installed
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [switch]$Force
    )

    if ((Test-AcrylicInstalled) -and -not $Force) {
        Write-OpenPathLog "Acrylic DNS Proxy already installed"
        return $true
    }

    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy", "Install")) {
        return $false
    }

    Write-OpenPathLog "Installing Acrylic DNS Proxy..."
    
    # Acrylic 2.2.x improves modern HTTPS query handling in the hosts cache,
    # which the Windows 2022 runner hits during end-to-end installation tests.
    $installerVersion = "2.2.1"
    $installerUrl = "https://sourceforge.net/projects/acrylic/files/Acrylic/$installerVersion/Acrylic-Portable.zip/download"
    $tempDir = "$env:TEMP\acrylic-install"
    $installDir = "${env:ProgramFiles(x86)}\Acrylic DNS Proxy"
    
    try {
        # Clean temp directory
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        # Download portable version
        Write-OpenPathLog "Downloading Acrylic..."
        $zipPath = "$tempDir\acrylic.zip"
        
        # Use System.Net.WebClient for better compatibility
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($installerUrl, $zipPath)
        
        # Extract
        Write-OpenPathLog "Extracting..."
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
        
        # Create install directory
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        }
        
        # Copy files
        $extractedDir = Get-ChildItem $tempDir -Directory | Select-Object -First 1
        if ($extractedDir) {
            Copy-Item "$($extractedDir.FullName)\*" $installDir -Recurse -Force
        }
        else {
            Copy-Item "$tempDir\*" $installDir -Recurse -Force -Exclude "*.zip"
        }
        
        # Install service
        Write-OpenPathLog "Installing Acrylic service..."
        $servicePath = "$installDir\AcrylicService.exe"
        if (Test-Path $servicePath) {
            & $servicePath /INSTALL 2>$null
            Start-Sleep -Seconds 2
        }
        
        Write-OpenPathLog "Acrylic DNS Proxy installed successfully"
        return $true
    }
    catch {
        $directInstallError = $_
        Write-OpenPathLog "Direct Acrylic install failed: $directInstallError" -Level WARN

        $choco = Get-Command choco -ErrorAction SilentlyContinue
        if ($choco) {
            Write-OpenPathLog "Falling back to Chocolatey package acrylic-dns-proxy..."
            & $choco.Source upgrade acrylic-dns-proxy -y --no-progress
            $chocoExitCode = $LASTEXITCODE
            $validExitCodes = @(0, 1605, 1614, 1641, 3010)

            if ($validExitCodes -contains $chocoExitCode) {
                Start-Sleep -Seconds 2
                if (Test-AcrylicInstalled) {
                    Write-OpenPathLog "Acrylic DNS Proxy installed successfully via Chocolatey"
                    return $true
                }
            }

            Write-OpenPathLog "Chocolatey fallback failed with exit code $chocoExitCode" -Level ERROR
        }

        Write-OpenPathLog "Failed to install Acrylic: $directInstallError" -Level ERROR
        return $false
    }
    finally {
        # Cleanup
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-OpenPathDnsSettings {
    <#
    .SYNOPSIS
        Resolves DNS-related OpenPath settings with safe defaults
    #>
    [CmdletBinding()]
    param()

    $settings = [ordered]@{
        PrimaryDNS = "8.8.8.8"
        SecondaryDNS = "8.8.4.4"
        MaxDomains = 500
    }

    try {
        $config = Get-OpenPathConfig

        if ($config.PSObject.Properties['primaryDNS'] -and $config.primaryDNS) {
            $settings.PrimaryDNS = [string]$config.primaryDNS
        }

        if ($config.PSObject.Properties['secondaryDNS'] -and $config.secondaryDNS) {
            $settings.SecondaryDNS = [string]$config.secondaryDNS
        }

        if ($config.PSObject.Properties['maxDomains'] -and ($config.maxDomains -as [int]) -gt 0) {
            $settings.MaxDomains = [int]$config.maxDomains
        }
    }
    catch {
        Write-Debug "OpenPath DNS settings unavailable, using defaults: $_"
    }

    return [PSCustomObject]$settings
}

function Get-AcrylicForwardRules {
    <#
    .SYNOPSIS
        Expands a domain into Acrylic FW rules for the root and subdomains
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Domain
    )

    $normalizedDomain = $Domain.Trim()
    if (-not $normalizedDomain) {
        return @()
    }

    return @(
        "FW $normalizedDomain",
        "FW >$normalizedDomain"
    )
}

function Get-AcrylicEssentialDomainGroups {
    [CmdletBinding()]
    param()

    return @(
        [PSCustomObject]@{
            Comment = '# Control plane and bootstrap/download'
            Domains = @(Get-OpenPathProtectedDomains)
        },
        [PSCustomObject]@{
            Comment = '# Captive portal detection'
            Domains = @('detectportal.firefox.com', 'connectivity-check.ubuntu.com', 'captive.apple.com', 'www.msftconnecttest.com', 'msftconnecttest.com', 'clients3.google.com')
        },
        [PSCustomObject]@{
            Comment = '# Windows Update (optional, comment out if not needed)'
            Domains = @('windowsupdate.microsoft.com', 'update.microsoft.com')
        },
        [PSCustomObject]@{
            Comment = '# NTP'
            Domains = @('time.windows.com', 'time.google.com')
        }
    )
}

function Get-AcrylicAffinityMaskEntries {
    [CmdletBinding()]
    param(
        [string[]]$Domains = @()
    )

    $entries = [System.Collections.Generic.List[string]]::new()
    $seenEntries = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($domain in @($Domains)) {
        $normalizedDomain = ([string]$domain).Trim().TrimEnd('.')
        if ($normalizedDomain.StartsWith('*.')) {
            $normalizedDomain = $normalizedDomain.Substring(2)
        }

        if (-not $normalizedDomain) {
            continue
        }

        foreach ($entry in @($normalizedDomain, "*.$normalizedDomain")) {
            if ($seenEntries.Add($entry)) {
                [void]$entries.Add($entry)
            }
        }
    }

    return $entries.ToArray()
}

function New-AcrylicHostsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [string]$Description = "",

        [string[]]$Lines = @()
    )

    return [PSCustomObject]@{
        Title = $Title
        Description = $Description
        Lines = @($Lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
}

function New-AcrylicHostsDefinition {
    <#
    .SYNOPSIS
        Builds the declarative model used to render AcrylicHosts.txt
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$WhitelistedDomains,

        [string[]]$BlockedSubdomains = @(),

        [pscustomobject]$DnsSettings = (Get-OpenPathDnsSettings)
    )

    $effectiveWhitelistedDomains = @($WhitelistedDomains)
    $originalWhitelistedDomainCount = $effectiveWhitelistedDomains.Count
    $wasTruncated = $false

    if ($effectiveWhitelistedDomains.Count -gt $DnsSettings.MaxDomains) {
        $effectiveWhitelistedDomains = @($effectiveWhitelistedDomains | Select-Object -First $DnsSettings.MaxDomains)
        $wasTruncated = $true
    }

    $essentialLines = @()
    $essentialDomains = @()
    foreach ($group in @(Get-AcrylicEssentialDomainGroups)) {
        if ($essentialLines.Count -gt 0) {
            $essentialLines += ''
        }

        $essentialLines += $group.Comment
        foreach ($domain in @($group.Domains)) {
            $essentialDomains += $domain
            $essentialLines += @(Get-AcrylicForwardRules -Domain $domain)
        }
    }

    $blockedLines = @(
        foreach ($subdomain in $BlockedSubdomains) {
            $normalizedSubdomain = ([string]$subdomain).Trim()
            if ($normalizedSubdomain) {
                "NX >$normalizedSubdomain"
            }
        }
    )

    $whitelistLines = @(
        foreach ($domain in $effectiveWhitelistedDomains) {
            @(Get-AcrylicForwardRules -Domain $domain)
        }
    )

    $sections = @(
        (New-AcrylicHostsSection `
            -Title 'ESSENTIAL DOMAINS (always allowed)' `
            -Description 'Required for system operation' `
            -Lines $essentialLines)
    )

    if ($blockedLines.Count -gt 0) {
        $sections += New-AcrylicHostsSection `
            -Title "BLOCKED SUBDOMAINS ($($blockedLines.Count))" `
            -Lines $blockedLines
    }

    $sections += New-AcrylicHostsSection `
        -Title "WHITELISTED DOMAINS ($($effectiveWhitelistedDomains.Count))" `
        -Lines @($whitelistLines)

    $sections += New-AcrylicHostsSection `
        -Title 'DEFAULT BLOCK (NXDOMAIN for everything else)' `
        -Description 'This MUST come last after FW rules.' `
        -Lines @('NX *')

    $affinityMaskEntries = Get-AcrylicAffinityMaskEntries -Domains @($essentialDomains + $effectiveWhitelistedDomains)

    return [PSCustomObject]@{
        UpstreamDNS = $DnsSettings.PrimaryDNS
        Sections = $sections
        WasTruncated = $wasTruncated
        OriginalWhitelistedDomainCount = $originalWhitelistedDomainCount
        EffectiveWhitelistedDomains = $effectiveWhitelistedDomains
        EssentialDomains = @($essentialDomains)
        AffinityMaskEntries = @($affinityMaskEntries)
        DomainAffinityMask = ($affinityMaskEntries -join ';')
        BlockedSubdomains = @($BlockedSubdomains)
    }
}

function ConvertTo-AcrylicHostsContent {
    <#
    .SYNOPSIS
        Renders a declarative Acrylic hosts definition to file content
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Definition
    )

    $lines = @(
        '# ========================================',
        '# OpenPath DNS - Generated by openpath-windows',
        "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "# Upstream DNS: $($Definition.UpstreamDNS)",
        '# ========================================',
        ''
    )

    foreach ($section in @($Definition.Sections)) {
        $lines += '# ========================================'
        $lines += "# $($section.Title)"
        if ($section.Description) {
            $lines += "# $($section.Description)"
        }
        $lines += '# ========================================'
        $lines += ''

        $sectionLines = @($section.Lines)
        if ($sectionLines.Count -gt 0) {
            $lines += $sectionLines
        }

        $lines += ''
    }

    return (($lines -join "`n").TrimEnd() + "`n")
}

function Update-AcrylicHost {
    <#
    .SYNOPSIS
        Generates AcrylicHosts.txt with whitelist configuration
    .PARAMETER WhitelistedDomains
        Array of domains to allow
    .PARAMETER BlockedSubdomains
        Array of subdomains to explicitly block
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$WhitelistedDomains,

        [string[]]$BlockedSubdomains = @()
    )

    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) {
        Write-OpenPathLog "Acrylic not found" -Level ERROR
        return $false
    }

    if (-not $PSCmdlet.ShouldProcess("AcrylicHosts.txt", "Update whitelist configuration")) {
        return $false
    }

    $hostsPath = "$acrylicPath\AcrylicHosts.txt"

    $dnsSettings = Get-OpenPathDnsSettings
    $definition = New-AcrylicHostsDefinition `
        -WhitelistedDomains $WhitelistedDomains `
        -BlockedSubdomains $BlockedSubdomains `
        -DnsSettings $dnsSettings

    if ($definition.WasTruncated) {
        Write-OpenPathLog "Truncating whitelist from $($definition.OriginalWhitelistedDomainCount) to $($dnsSettings.MaxDomains) domains" -Level WARN
    }

    Write-OpenPathLog "Generating AcrylicHosts.txt with $(@($definition.EffectiveWhitelistedDomains).Count) domains..."

    $content = ConvertTo-AcrylicHostsContent -Definition $definition
    
    # Write to file
    $content | Set-Content $hostsPath -Encoding UTF8 -Force

    $configurationUpdated = Set-AcrylicConfiguration -WhitelistedDomains $definition.EffectiveWhitelistedDomains
    if (-not $configurationUpdated) {
        Write-OpenPathLog "Failed to update AcrylicConfiguration.ini" -Level ERROR
        return $false
    }
    
    Write-OpenPathLog "AcrylicHosts.txt updated"
    return $true
}

function Set-AcrylicConfiguration {
    <#
    .SYNOPSIS
        Configures AcrylicConfiguration.ini with optimal settings
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [AllowEmptyCollection()]
        [string[]]$WhitelistedDomains = @()
    )

    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) {
        return $false
    }

    if (-not $PSCmdlet.ShouldProcess("AcrylicConfiguration.ini", "Configure Acrylic settings")) {
        return $false
    }

    $configPath = "$acrylicPath\AcrylicConfiguration.ini"

    $dnsSettings = Get-OpenPathDnsSettings

    $definition = New-AcrylicHostsDefinition `
        -WhitelistedDomains $WhitelistedDomains `
        -DnsSettings $dnsSettings

    Write-OpenPathLog "Configuring Acrylic..."
    
    # Read existing config or create new
    if (Test-Path $configPath) {
        $iniContent = Get-Content $configPath -Raw
    }
    else {
        $iniContent = ""
    }
    
    # Key settings to ensure
    $settings = @{
        "PrimaryServerAddress" = $dnsSettings.PrimaryDNS
        "SecondaryServerAddress" = $dnsSettings.SecondaryDNS
        "LocalIPv4BindingAddress" = "127.0.0.1"
        "LocalIPv4BindingPort" = "53"
        "PrimaryServerDomainNameAffinityMask" = $definition.DomainAffinityMask
        "SecondaryServerDomainNameAffinityMask" = $definition.DomainAffinityMask
        "IgnoreNegativeResponsesFromPrimaryServer" = "No"
        "IgnoreNegativeResponsesFromSecondaryServer" = "No"
        "AddressCacheDisabled" = "Yes"
        "AddressCacheNegativeTime" = "0"
        "CacheSize" = "65536"
        "HitLogFileName" = ""
        "ErrorLogFileName" = ""
    }
    
    # Update or add settings
    foreach ($key in $settings.Keys) {
        $pattern = "(?m)^$key=.*$"
        $replacement = "$key=$($settings[$key])"
        
        if ($iniContent -match $pattern) {
            $iniContent = $iniContent -replace $pattern, $replacement
        }
        else {
            $iniContent += "`n$replacement"
        }
    }
    
    $iniContent | Set-Content $configPath -Encoding UTF8 -Force
    
    Write-OpenPathLog "Acrylic configuration updated"
    return $true
}

function Clear-AcrylicCache {
    <#
    .SYNOPSIS
        Deletes AcrylicCache.dat so stale cached answers cannot bypass updated policy
    #>
    [CmdletBinding()]
    param()

    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) {
        return $false
    }

    $cachePath = "$acrylicPath\AcrylicCache.dat"
    if (-not (Test-Path $cachePath)) {
        return $true
    }

    try {
        Remove-Item $cachePath -Force -ErrorAction SilentlyContinue
        Write-OpenPathLog "Purged Acrylic address cache"
        return $true
    }
    catch {
        Write-OpenPathLog "Failed to purge Acrylic address cache: $_" -Level WARN
        return $false
    }
}

function Set-LocalDNS {
    <#
    .SYNOPSIS
        Configures all active network adapters to use 127.0.0.1 as DNS
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param()

    if (-not $PSCmdlet.ShouldProcess("Network adapters", "Set DNS to 127.0.0.1")) {
        return
    }

    Write-OpenPathLog "Configuring local DNS..."

    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    
    foreach ($adapter in $adapters) {
        try {
            Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses "127.0.0.1"
            Write-OpenPathLog "Set DNS for adapter: $($adapter.Name)"
        }
        catch {
            Write-OpenPathLog "Failed to set DNS for $($adapter.Name): $_" -Level WARN
        }
    }
    
    # Flush DNS cache
    Clear-DnsClientCache
    Write-OpenPathLog "DNS cache flushed"
}

function Restore-OriginalDNS {
    <#
    .SYNOPSIS
        Restores network adapters to automatic DNS
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param()

    if (-not $PSCmdlet.ShouldProcess("Network adapters", "Reset DNS to automatic")) {
        return
    }

    Write-OpenPathLog "Restoring original DNS settings..."

    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    
    foreach ($adapter in $adapters) {
        try {
            Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses
            Write-OpenPathLog "Reset DNS for adapter: $($adapter.Name)"
        }
        catch {
            Write-OpenPathLog "Failed to reset DNS for $($adapter.Name): $_" -Level WARN
        }
    }
    
    Clear-DnsClientCache
}

function Restart-AcrylicService {
    <#
    .SYNOPSIS
        Restarts the Acrylic DNS Proxy service
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param()

    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Restart")) {
        return $false
    }

    Write-OpenPathLog "Restarting Acrylic service..."

    $serviceName = "AcrylicDNSProxySvc"
    
    try {
        Clear-AcrylicCache | Out-Null

        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        
        if (-not $service) {
            # Try alternative name
            $service = Get-Service -DisplayName "*Acrylic*" -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        
        if ($service) {
            Restart-Service -Name $service.Name -Force
            Start-Sleep -Seconds 2
            
            $service = Get-Service -Name $service.Name
            if ($service.Status -eq 'Running') {
                Write-OpenPathLog "Acrylic service restarted successfully"
                return $true
            }
        }
        
        # Fallback: use batch file
        $acrylicPath = Get-AcrylicPath
        if ($acrylicPath -and (Test-Path "$acrylicPath\RestartAcrylicService.bat")) {
            & cmd /c "$acrylicPath\RestartAcrylicService.bat" 2>$null
            Start-Sleep -Seconds 2
            Write-OpenPathLog "Acrylic service restarted via batch file"
            return $true
        }
        
        Write-OpenPathLog "Could not restart Acrylic service" -Level ERROR
        return $false
    }
    catch {
        Write-OpenPathLog "Error restarting Acrylic: $_" -Level ERROR
        return $false
    }
}

function Start-AcrylicService {
    <#
    .SYNOPSIS
        Starts the Acrylic DNS Proxy service
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param()

    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Start")) {
        return $false
    }

    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) {
        return $false
    }
    
    try {
        $service = Get-Service -DisplayName "*Acrylic*" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($service) {
            if ($service.Status -ne 'Running') {
                Start-Service -Name $service.Name
                Start-Sleep -Seconds 2
            }
            return $true
        }
        
        # Start via executable
        if (Test-Path "$acrylicPath\StartAcrylicService.bat") {
            & cmd /c "$acrylicPath\StartAcrylicService.bat" 2>$null
            Start-Sleep -Seconds 2
            return $true
        }
        
        return $false
    }
    catch {
        Write-OpenPathLog "Error starting Acrylic: $_" -Level ERROR
        return $false
    }
}

function Stop-AcrylicService {
    <#
    .SYNOPSIS
        Stops the Acrylic DNS Proxy service
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param()

    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Stop")) {
        return $false
    }

    try {
        $service = Get-Service -DisplayName "*Acrylic*" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($service -and $service.Status -eq 'Running') {
            Stop-Service -Name $service.Name -Force
            Start-Sleep -Seconds 1
        }
        
        return $true
    }
    catch {
        Write-OpenPathLog "Error stopping Acrylic: $_" -Level ERROR
        return $false
    }
}

function Resolve-OpenPathDnsWithRetry {
    <#
    .SYNOPSIS
        Resolves a DNS name through the local Acrylic proxy with retry support
    .PARAMETER Domain
        Domain to resolve
    .PARAMETER Server
        DNS server to query
    .PARAMETER MaxAttempts
        Maximum number of attempts before giving up
    .PARAMETER DelayMilliseconds
        Delay between attempts in milliseconds
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Domain,

        [string]$Server = "127.0.0.1",

        [int]$MaxAttempts = 12,

        [int]$DelayMilliseconds = 1000
    )

    $lastError = $null

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $result = Resolve-DnsName -Name $Domain -Server $Server -DnsOnly -ErrorAction Stop
            if ($result) {
                return $result
            }
        }
        catch {
            $lastError = $_
        }

        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }

    if ($lastError) {
        Write-OpenPathLog "DNS resolution failed for $Domain via $Server after $MaxAttempts attempts: $lastError" -Level WARN
    }

    return $null
}

function Test-DNSResolution {
    <#
    .SYNOPSIS
        Tests if DNS resolution is working correctly
    .PARAMETER Domain
        Optional domain to test. When omitted, uses the first policy-allowed probe domain.
    #>
    param(
        [string]$Domain = "",

        [int]$MaxAttempts = 12,

        [int]$DelayMilliseconds = 1000
    )

    $probeDomain = ([string]$Domain).Trim()
    if (-not $probeDomain) {
        $probeDomain = @((Get-OpenPathDnsProbeDomains) | Select-Object -First 1)[0]
    }

    if (-not $probeDomain) {
        Write-OpenPathLog "DNS resolution probe skipped because no allowed probe domains are available" -Level WARN
        return $false
    }

    $result = Resolve-OpenPathDnsWithRetry `
        -Domain $probeDomain `
        -MaxAttempts $MaxAttempts `
        -DelayMilliseconds $DelayMilliseconds

    return ($null -ne $result)
}

function Test-DNSSinkhole {
    <#
    .SYNOPSIS
        Tests if the DNS sinkhole is working (blocking non-whitelisted domains)
    .PARAMETER Domain
        Domain to test (should NOT be whitelisted)
    #>
    param(
        [string]$Domain = "should-not-exist-test.com"
    )
    
    try {
        $result = Resolve-DnsName -Name $Domain -Server 127.0.0.1 -DnsOnly -ErrorAction SilentlyContinue
        # If we get NXDOMAIN or no result, sinkhole is working
        return ($null -eq $result)
    }
    catch {
        # Error means blocked - sinkhole working
        return $true
    }
}

# Export module members
Export-ModuleMember -Function @(
    'Get-AcrylicPath',
    'Test-AcrylicInstalled',
    'Install-AcrylicDNS',
    'Update-AcrylicHost',
    'Set-AcrylicConfiguration',
    'Set-LocalDNS',
    'Restore-OriginalDNS',
    'Restart-AcrylicService',
    'Start-AcrylicService',
    'Stop-AcrylicService',
    'Resolve-OpenPathDnsWithRetry',
    'Test-DNSResolution',
    'Test-DNSSinkhole'
)

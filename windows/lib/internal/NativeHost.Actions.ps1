function Get-NativeHostValidDomains {
    param(
        [AllowNull()]
        [object[]]$Domains = @()
    )

    return @($Domains) |
        Where-Object { $_ -is [string] } |
        ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } |
        Where-Object { $_ -match '^[a-z0-9.-]+$' } |
        Select-Object -First $script:MaxDomains
}

function Test-NativeWhitelistContainsDomains {
    param(
        [string[]]$Domains = @()
    )

    if (@($Domains).Count -eq 0) {
        return $true
    }

    $sections = Get-WhitelistSections
    $whitelistSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($domain in @($sections.Whitelist)) {
        if ($domain) {
            $null = $whitelistSet.Add([string]$domain)
        }
    }

    foreach ($domain in @($Domains)) {
        if (-not $whitelistSet.Contains($domain)) {
            return $false
        }
    }

    return $true
}

function Invoke-UpdateTask {
    param(
        [string[]]$Domains = @(),
        [int]$TimeoutSeconds = 45
    )

    try {
        $null = & schtasks.exe /Run /TN $script:UpdateTaskName 2>$null
        if ($LASTEXITCODE -ne 0) {
            return @{
                success = $false
                action = 'update-whitelist'
                error = "schtasks exit code $LASTEXITCODE"
            }
        }

        if (-not (Test-NativeWhitelistContainsDomains -Domains $Domains)) {
            $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
            while ((Get-Date) -lt $deadline) {
                Start-Sleep -Milliseconds 1000
                if (Test-NativeWhitelistContainsDomains -Domains $Domains) {
                    return @{
                        success = $true
                        action = 'update-whitelist'
                        message = 'OpenPath update task wrote expected domains'
                        domains = @($Domains)
                    }
                }
            }

            return @{
                success = $false
                action = 'update-whitelist'
                error = "OpenPath update task did not write expected domains: $(@($Domains) -join ', ')"
                domains = @($Domains)
            }
        }

        return @{
            success = $true
            action = 'update-whitelist'
            message = 'OpenPath update task triggered'
            domains = @($Domains)
        }
    }
    catch {
        return @{
            success = $false
            action = 'update-whitelist'
            error = [string]$_
        }
    }
}

function Get-NativeHostMachineName {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$State
    )

    if ($State.PSObject.Properties['machineName'] -and $State.machineName) {
        return [string]$State.machineName
    }

    return [string]$env:COMPUTERNAME
}

function Get-NativeHostApiUrl {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$State
    )

    if ($State.PSObject.Properties['requestApiUrl'] -and $State.requestApiUrl) {
        return ([string]$State.requestApiUrl).TrimEnd('/')
    }
    if ($State.PSObject.Properties['apiUrl'] -and $State.apiUrl) {
        return ([string]$State.apiUrl).TrimEnd('/')
    }

    return ''
}

function Get-NativeHostBlockedPathResponse {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Sections
    )

    $paths = @($Sections.BlockedPaths)
    $digest = ''
    if ($paths.Count -gt 0) {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes(($paths -join "`n"))
            $digest = ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
        }
        finally {
            $sha.Dispose()
        }
    }

    $mtime = 0
    if (Test-Path $script:WhitelistPath) {
        $whitelistItem = Get-Item $script:WhitelistPath
        $mtime = [int]([DateTimeOffset]$whitelistItem.LastWriteTimeUtc).ToUnixTimeSeconds()
    }

    return @{
        success = $true
        action = 'get-blocked-paths'
        paths = $paths
        count = $paths.Count
        hash = $digest
        mtime = $mtime
        source = $script:WhitelistPath
    }
}

function Invoke-NativeHostCheckAction {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Message,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Sections
    )

    $validDomains = Get-NativeHostValidDomains -Domains @($Message.domains)

    $whitelistSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($domain in @($Sections.Whitelist)) {
        if ($domain) {
            $null = $whitelistSet.Add([string]$domain)
        }
    }

    $results = foreach ($domain in $validDomains) {
        @{
            domain = $domain
            in_whitelist = $whitelistSet.Contains($domain)
            resolved_ip = (Resolve-DomainIp -Domain $domain)
        }
    }

    return @{
        success = $true
        action = 'check'
        results = @($results)
    }
}

function Handle-Message {
    param(
        [AllowNull()]
        [object]$Message
    )

    if (-not ($Message -is [System.Collections.IDictionary]) -and -not $Message.PSObject) {
        return @{ success = $false; error = 'Invalid message format' }
    }

    $state = Read-NativeState
    $sections = Get-WhitelistSections
    $action = [string]$Message.action

    switch ($action) {
        'ping' {
            return @{
                success = $true
                action = 'ping'
                message = 'pong'
                version = if ($state.PSObject.Properties['version']) { [string]$state.version } else { '' }
            }
        }

        'get-hostname' {
            return @{
                success = $true
                action = 'get-hostname'
                hostname = (Get-NativeHostMachineName -State $state)
            }
        }

        'get-machine-token' {
            $whitelistUrl = if ($state.PSObject.Properties['whitelistUrl']) { [string]$state.whitelistUrl } else { '' }
            $token = Get-MachineTokenFromWhitelistUrl -WhitelistUrl $whitelistUrl
            if (-not $token) {
                return @{
                    success = $false
                    action = 'get-machine-token'
                    error = 'Machine token not available'
                }
            }

            return @{
                success = $true
                action = 'get-machine-token'
                token = $token
            }
        }

        'get-config' {
            $apiUrl = Get-NativeHostApiUrl -State $state
            $whitelistUrl = if ($state.PSObject.Properties['whitelistUrl']) { [string]$state.whitelistUrl } else { '' }
            $machineToken = Get-MachineTokenFromWhitelistUrl -WhitelistUrl $whitelistUrl

            if (-not $apiUrl) {
                return @{
                    success = $false
                    action = 'get-config'
                    error = 'API URL is not configured'
                }
            }

            return @{
                success = $true
                action = 'get-config'
                apiUrl = $apiUrl
                requestApiUrl = $apiUrl
                fallbackApiUrls = @()
                hostname = (Get-NativeHostMachineName -State $state)
                machineToken = if ($machineToken) { $machineToken } else { '' }
                whitelistUrl = $whitelistUrl
            }
        }

        'get-blocked-paths' {
            return (Get-NativeHostBlockedPathResponse -Sections $sections)
        }

        'check' {
            return (Invoke-NativeHostCheckAction -Message $Message -Sections $sections)
        }

        'update-whitelist' {
            $domains = Get-NativeHostValidDomains -Domains @($Message.domains)
            return (Invoke-UpdateTask -Domains $domains)
        }

        default {
            return @{
                success = $false
                error = "Unknown action: $action"
            }
        }
    }
}

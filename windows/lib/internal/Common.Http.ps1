function Ensure-OpenPathHttpAssembly {
    if ('System.Net.Http.HttpClientHandler' -as [type]) {
        return
    }

    try {
        Add-Type -AssemblyName 'System.Net.Http' -ErrorAction Stop
    }
    catch {
        try {
            [System.Reflection.Assembly]::Load('System.Net.Http') | Out-Null
        }
        catch {
            throw "Failed to load System.Net.Http assembly: $_"
        }
    }

    if (-not ('System.Net.Http.HttpClientHandler' -as [type])) {
        throw 'System.Net.Http assembly loaded, but HttpClientHandler is still unavailable'
    }
}

function Invoke-OpenPathHttpGetText {
    <#
    .SYNOPSIS
        Performs a GET request and returns status, content, and ETag.
    .PARAMETER RequestUrl
        Full URL to request.
    .PARAMETER IfNoneMatch
        Optional ETag value to send as If-None-Match.
    .PARAMETER TimeoutSec
        Request timeout in seconds.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$RequestUrl,

        [string]$IfNoneMatch,

        [int]$TimeoutSec = 30
    )

    $client = $null
    $response = $null

    try {
        Ensure-OpenPathHttpAssembly

        $handler = [System.Net.Http.HttpClientHandler]::new()
        if ($handler.PSObject.Properties['AutomaticDecompression']) {
            $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
        }

        $client = [System.Net.Http.HttpClient]::new($handler)
        $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)

        $request = [System.Net.Http.HttpRequestMessage]::new(
            [System.Net.Http.HttpMethod]::Get,
            $RequestUrl
        )

        if ($IfNoneMatch) {
            try {
                $request.Headers.IfNoneMatch.Add([System.Net.Http.Headers.EntityTagHeaderValue]::Parse($IfNoneMatch))
            }
            catch {
                # Ignore invalid cached ETag
            }
        }

        $response = $client.SendAsync($request).GetAwaiter().GetResult()

        $statusCode = [int]$response.StatusCode
        $etag = $null
        if ($response.Headers.ETag) {
            $etag = $response.Headers.ETag.ToString()
        }

        if ($statusCode -eq 304) {
            return [PSCustomObject]@{
                StatusCode = $statusCode
                Content    = ''
                ETag       = $etag
            }
        }

        if (-not $response.IsSuccessStatusCode) {
            throw "HTTP $statusCode"
        }

        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return [PSCustomObject]@{
            StatusCode = $statusCode
            Content    = $content
            ETag       = $etag
        }
    }
    finally {
        if ($response) { $response.Dispose() }
        if ($client) { $client.Dispose() }
    }
}

function Get-OpenPathFromUrl {
    <#
    .SYNOPSIS
        Downloads and parses whitelist from URL
    .PARAMETER Url
        URL to download whitelist from
    .OUTPUTS
        Hashtable with Whitelist, BlockedSubdomains, and BlockedPaths arrays
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    Write-OpenPathLog "Downloading whitelist from $Url"

    $etagPath = Join-Path $script:OpenPathRoot 'data\whitelist.etag'
    $cachedEtag = $null
    if (Test-Path $etagPath) {
        try {
            $cachedEtag = (Get-Content $etagPath -Raw -ErrorAction Stop).Trim()
        }
        catch {
            $cachedEtag = $null
        }
    }

    $httpResult = $null
    try {
        $httpResult = Invoke-OpenPathHttpGetText -RequestUrl $Url -IfNoneMatch $cachedEtag -TimeoutSec 30
    }
    catch {
        Write-OpenPathLog "Failed to download whitelist: $_" -Level ERROR
        throw
    }

    $result = [PSCustomObject]@{
        Whitelist = @()
        BlockedSubdomains = @()
        BlockedPaths = @()
        IsDisabled = $false
        NotModified = $false
    }

    if ($httpResult -and $httpResult.StatusCode -eq 304) {
        $result.NotModified = $true
        Write-OpenPathLog "Whitelist unchanged (ETag match)"
        return $result
    }

    $content = if ($httpResult) { [string]$httpResult.Content } else { '' }
    $newEtag = if ($httpResult) { [string]$httpResult.ETag } else { $null }

    $currentSection = "WHITELIST"

    foreach ($line in $content -split "`n") {
        $line = $line.Trim()

        if (-not $line) { continue }

        if ($line -match '^#\s*DESACTIVADO\b') {
            $result.IsDisabled = $true
            continue
        }

        if ($line -match "^##\s*(.+)$") {
            $currentSection = $Matches[1].Trim().ToUpper()
            continue
        }

        if ($line.StartsWith("#")) { continue }

        switch ($currentSection) {
            "WHITELIST"           { $result.Whitelist += $line }
            "BLOCKED-SUBDOMAINS"  { $result.BlockedSubdomains += $line }
            "BLOCKED-PATHS"       { $result.BlockedPaths += $line }
        }
    }

    if ($result.IsDisabled) {
        Write-OpenPathLog "Parsed: $($result.Whitelist.Count) whitelisted, $($result.BlockedSubdomains.Count) blocked subdomains, $($result.BlockedPaths.Count) blocked paths, disabled=$($result.IsDisabled)"
        Write-OpenPathLog "Remote disable marker detected - skipping minimum-domain validation" -Level WARN
        if ($newEtag) {
            try {
                $dir = Split-Path $etagPath -Parent
                if (-not (Test-Path $dir)) {
                    New-Item -ItemType Directory -Path $dir -Force | Out-Null
                }
                $newEtag | Set-Content -Path $etagPath -Encoding ASCII
            }
            catch {
                # Non-fatal
            }
        }
        return $result
    }

    $protectedDomains = @(Get-OpenPathProtectedDomains)
    $protectedDomainSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($domain in $protectedDomains) {
        if ($domain) {
            $protectedDomainSet.Add($domain) | Out-Null
        }
    }

    if ($protectedDomainSet.Count -gt 0) {
        $effectiveWhitelist = [System.Collections.Generic.List[string]]::new()
        $whitelistSeen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

        foreach ($domain in @($result.Whitelist) + $protectedDomains) {
            $normalizedDomain = ([string]$domain).Trim().Trim('.')
            if (-not $normalizedDomain) {
                continue
            }

            if ((Test-OpenPathDomainFormat -Domain $normalizedDomain) -and $whitelistSeen.Add($normalizedDomain)) {
                $effectiveWhitelist.Add($normalizedDomain) | Out-Null
            }
        }

        $blockedSubdomainRemovals = 0
        $filteredBlockedSubdomains = @(
            foreach ($subdomain in @($result.BlockedSubdomains)) {
                $normalizedSubdomain = ([string]$subdomain).Trim().Trim('.')
                if (-not $normalizedSubdomain) {
                    continue
                }

                if ($protectedDomainSet.Contains($normalizedSubdomain)) {
                    $blockedSubdomainRemovals++
                    continue
                }

                $normalizedSubdomain
            }
        )

        $blockedPathRemovals = 0
        $filteredBlockedPaths = @(
            foreach ($pathRule in @($result.BlockedPaths)) {
                $protectedPathHost = Get-OpenPathHostFromBlockedPathRule -Rule $pathRule
                if ($protectedPathHost -and $protectedDomainSet.Contains($protectedPathHost)) {
                    $blockedPathRemovals++
                    continue
                }

                $pathRule
            }
        )

        if ($blockedSubdomainRemovals -gt 0 -or $blockedPathRemovals -gt 0) {
            Write-OpenPathLog "Removed $blockedSubdomainRemovals blocked subdomains and $blockedPathRemovals blocked paths targeting protected control-plane domains" -Level WARN
        }

        $result.Whitelist = @($effectiveWhitelist)
        $result.BlockedSubdomains = @($filteredBlockedSubdomains)
        $result.BlockedPaths = @($filteredBlockedPaths)
    }

    Write-OpenPathLog "Parsed: $($result.Whitelist.Count) whitelisted, $($result.BlockedSubdomains.Count) blocked subdomains, $($result.BlockedPaths.Count) blocked paths, disabled=$($result.IsDisabled)"

    $validDomains = $result.Whitelist | Where-Object { Test-OpenPathDomainFormat -Domain $_ }
    $minRequiredDomains = 1
    if ($validDomains.Count -lt $minRequiredDomains) {
        Write-OpenPathLog "Downloaded whitelist appears invalid ($($validDomains.Count) valid domains, minimum $minRequiredDomains required)" -Level ERROR
        throw "Invalid whitelist content: insufficient valid domains ($($validDomains.Count)/$minRequiredDomains)"
    }

    if ($newEtag) {
        try {
            $dir = Split-Path $etagPath -Parent
            if (-not (Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            $newEtag | Set-Content -Path $etagPath -Encoding ASCII
        }
        catch {
            # Non-fatal
        }
    }

    return $result
}

function Test-InternetConnection {
    <#
    .SYNOPSIS
        Tests if there is an active internet connection
    #>
    $testServer = '8.8.8.8'
    try {
        $result = Test-NetConnection -ComputerName $testServer -Port 53 -WarningAction SilentlyContinue
        return $result.TcpTestSucceeded
    }
    catch {
        return $false
    }
}

function Send-OpenPathHealthReport {
    <#
    .SYNOPSIS
        Sends machine health status to central API via tRPC
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,

        [bool]$DnsServiceRunning = $false,

        [bool]$DnsResolving = $false,

        [int]$FailCount = 0,

        [string]$Actions = '',

        [string]$Version = 'unknown'
    )

    $config = $null
    try {
        $config = Get-OpenPathConfig
    }
    catch {
        return $false
    }

    if (-not ($config.PSObject.Properties['apiUrl']) -or -not $config.apiUrl) {
        return $false
    }

    $versionToSend = $Version
    if ($versionToSend -eq 'unknown' -and $config.PSObject.Properties['version'] -and $config.version) {
        $versionToSend = [string]$config.version
    }

    $authToken = ''
    if ($config.PSObject.Properties['whitelistUrl'] -and $config.whitelistUrl) {
        $authToken = Get-OpenPathMachineTokenFromWhitelistUrl -WhitelistUrl ([string]$config.whitelistUrl)
    }

    if (-not $authToken -and $config.PSObject.Properties['healthApiSecret'] -and $config.healthApiSecret) {
        $authToken = [string]$config.healthApiSecret
    }
    elseif (-not $authToken -and $env:OPENPATH_HEALTH_API_SECRET) {
        $authToken = [string]$env:OPENPATH_HEALTH_API_SECRET
    }

    $payload = @{
        json = @{
            hostname = Get-OpenPathMachineName
            status = $Status
            dnsmasqRunning = [bool]$DnsServiceRunning
            dnsResolving = [bool]$DnsResolving
            failCount = [int]$FailCount
            actions = [string]$Actions
            version = [string]$versionToSend
        }
    } | ConvertTo-Json -Depth 8

    $healthUrl = "$($config.apiUrl.TrimEnd('/'))/trpc/healthReports.submit"
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($authToken) {
        $headers['Authorization'] = "Bearer $authToken"
    }

    try {
        Invoke-RestMethod -Uri $healthUrl -Method Post -Headers $headers -Body $payload `
            -TimeoutSec 10 -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        Write-OpenPathLog "Health report failed (non-critical): $_" -Level WARN
        return $false
    }
}

function Get-OpenPathMachineTokenFromWhitelistUrl {
    <#
    .SYNOPSIS
        Extracts machine token from tokenized whitelist URL
    .PARAMETER WhitelistUrl
        URL formatted as .../w/<token>/whitelist.txt
    #>
    param(
        [string]$WhitelistUrl
    )

    if (-not $WhitelistUrl) {
        return $null
    }

    if ($WhitelistUrl -match '/w/([^/]+)/') {
        return [string]$Matches[1]
    }

    return $null
}

function Compare-OpenPathVersion {
    <#
    .SYNOPSIS
        Compares semantic-like versions and returns -1, 0, or 1
    #>
    param(
        [string]$CurrentVersion,
        [string]$TargetVersion
    )

    $currentMatch = [regex]::Match([string]$CurrentVersion, '\d+(?:\.\d+){0,3}')
    $targetMatch = [regex]::Match([string]$TargetVersion, '\d+(?:\.\d+){0,3}')

    $currentNormalized = if ($currentMatch.Success) { $currentMatch.Value } else { '0.0.0' }
    $targetNormalized = if ($targetMatch.Success) { $targetMatch.Value } else { '0.0.0' }

    try {
        $currentParsed = [version]$currentNormalized
        $targetParsed = [version]$targetNormalized
        return $currentParsed.CompareTo($targetParsed)
    }
    catch {
        return [string]::Compare($currentNormalized, $targetNormalized, $true)
    }
}

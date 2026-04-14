function Resolve-OpenPathDnsWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Domain,
        [string]$Server = "127.0.0.1",
        [int]$MaxAttempts = 12,
        [int]$DelayMilliseconds = 1000
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $result = Resolve-DnsName -Name $Domain -Server $Server -DnsOnly -ErrorAction Stop
            if ($result) { return $result }
        }
        catch { $lastError = $_ }
        if ($attempt -lt $MaxAttempts) { Start-Sleep -Milliseconds $DelayMilliseconds }
    }

    if ($lastError) {
        Write-OpenPathLog "DNS resolution failed for $Domain via $Server after $MaxAttempts attempts: $lastError" -Level WARN
    }
    return $null
}

function Test-DNSResolution {
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

    $result = Resolve-OpenPathDnsWithRetry -Domain $probeDomain -MaxAttempts $MaxAttempts -DelayMilliseconds $DelayMilliseconds
    return ($null -ne $result)
}

function Test-DNSSinkhole {
    param([string]$Domain = "should-not-exist-test.com")
    try {
        $result = Resolve-DnsName -Name $Domain -Server 127.0.0.1 -DnsOnly -ErrorAction SilentlyContinue
        return ($null -eq $result)
    }
    catch {
        return $true
    }
}

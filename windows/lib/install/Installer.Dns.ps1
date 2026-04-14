function Test-InstallerDirectDnsServer {
    param(
        [Parameter(Mandatory = $true)][string]$Server,
        [string]$ProbeDomain = 'google.com'
    )

    if (-not $Server -or $Server -in @('127.0.0.1', '0.0.0.0')) { return $false }
    if ($Server -notmatch '^\d{1,3}(?:\.\d{1,3}){3}$') { return $false }

    try {
        $result = Resolve-DnsName -Name $ProbeDomain -Server $Server -DnsOnly -ErrorAction Stop
        return ($null -ne $result)
    }
    catch {
        return $false
    }
}

function Test-InstallerDisfavoredDnsServer {
    param([Parameter(Mandatory = $true)][string]$Server)
    return $Server -in @('168.63.129.16')
}

function Get-InstallerPrimaryDNS {
    $preferredCandidates = @(
        Get-DnsClientServerAddress -AddressFamily IPv4 |
            ForEach-Object { @($_.ServerAddresses) } |
            Where-Object {
                $_ -and
                $_ -notin @('127.0.0.1', '0.0.0.0') -and
                $_ -match '^\d{1,3}(?:\.\d{1,3}){3}$'
            }
    )

    $gateway = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -First 1).NextHop
    if ($gateway -and $gateway -notin @('127.0.0.1', '0.0.0.0') -and $gateway -match '^\d{1,3}(?:\.\d{1,3}){3}$') {
        $preferredCandidates += $gateway
    }

    $preferredCandidates = @($preferredCandidates | Select-Object -Unique)
    $disfavoredCandidates = @($preferredCandidates | Where-Object { Test-InstallerDisfavoredDnsServer -Server $_ })
    $preferredCandidates = @($preferredCandidates | Where-Object { -not (Test-InstallerDisfavoredDnsServer -Server $_) })
    $fallbackCandidates = @('8.8.8.8', '1.1.1.1', '9.9.9.9', '8.8.4.4')

    foreach ($candidate in (@($preferredCandidates) + @($fallbackCandidates) + @($disfavoredCandidates))) {
        if (Test-InstallerDirectDnsServer -Server $candidate) {
            return $candidate
        }
    }

    if ($preferredCandidates.Count -gt 0) { return $preferredCandidates[0] }
    if ($disfavoredCandidates.Count -gt 0) { return $disfavoredCandidates[0] }
    return '8.8.8.8'
}

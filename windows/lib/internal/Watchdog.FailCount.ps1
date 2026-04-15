function Get-WatchdogFailCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WatchdogFailCountPath
    )

    if (-not (Test-Path $WatchdogFailCountPath)) {
        return 0
    }

    try {
        $rawValue = Get-Content $WatchdogFailCountPath -Raw -ErrorAction Stop
        return [int]$rawValue
    }
    catch {
        return 0
    }
}

function Set-WatchdogFailCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WatchdogFailCountPath,

        [Parameter(Mandatory = $true)]
        [int]$Count
    )

    Set-Content $WatchdogFailCountPath -Value ([Math]::Max($Count, 0)) -Encoding UTF8
}

function Increment-WatchdogFailCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WatchdogFailCountPath
    )

    $newCount = (Get-WatchdogFailCount -WatchdogFailCountPath $WatchdogFailCountPath) + 1
    Set-WatchdogFailCount -WatchdogFailCountPath $WatchdogFailCountPath -Count $newCount
    return $newCount
}

function Reset-WatchdogFailCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WatchdogFailCountPath
    )

    Set-WatchdogFailCount -WatchdogFailCountPath $WatchdogFailCountPath -Count 0
}

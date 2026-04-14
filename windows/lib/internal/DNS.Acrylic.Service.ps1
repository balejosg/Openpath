function Clear-AcrylicCache {
    [CmdletBinding()] param()
    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) { return $false }
    $cachePath = "$acrylicPath\AcrylicCache.dat"
    if (-not (Test-Path $cachePath)) { return $true }
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
    [CmdletBinding(SupportsShouldProcess)] param()
    if (-not $PSCmdlet.ShouldProcess("Network adapters", "Set DNS to 127.0.0.1")) { return }
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
    Clear-DnsClientCache
    Write-OpenPathLog "DNS cache flushed"
}

function Restore-OriginalDNS {
    [CmdletBinding(SupportsShouldProcess)] param()
    if (-not $PSCmdlet.ShouldProcess("Network adapters", "Reset DNS to automatic")) { return }
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
    [CmdletBinding(SupportsShouldProcess)] param()
    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Restart")) { return $false }
    Write-OpenPathLog "Restarting Acrylic service..."
    $serviceName = "AcrylicDNSProxySvc"
    try {
        Clear-AcrylicCache | Out-Null
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if (-not $service) { $service = Get-Service -DisplayName "*Acrylic*" -ErrorAction SilentlyContinue | Select-Object -First 1 }
        if ($service) {
            Restart-Service -Name $service.Name -Force
            Start-Sleep -Seconds 2
            $service = Get-Service -Name $service.Name
            if ($service.Status -eq 'Running') {
                Write-OpenPathLog "Acrylic service restarted successfully"
                return $true
            }
        }
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
    [CmdletBinding(SupportsShouldProcess)] param()
    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Start")) { return $false }
    $acrylicPath = Get-AcrylicPath
    if (-not $acrylicPath) { return $false }
    try {
        $service = Get-Service -DisplayName "*Acrylic*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($service) {
            if ($service.Status -ne 'Running') {
                Start-Service -Name $service.Name
                Start-Sleep -Seconds 2
            }
            return $true
        }
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
    [CmdletBinding(SupportsShouldProcess)] param()
    if (-not $PSCmdlet.ShouldProcess("Acrylic DNS Proxy service", "Stop")) { return $false }
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

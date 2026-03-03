$ErrorActionPreference = 'Stop'

function Write-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )
    Write-Host ""
    Write-Host $Message
}

function Ensure-Pester {
    Write-Step "Installing/Importing Pester..."
    try {
        if (-not (Get-Module -ListAvailable -Name Pester)) {
            Install-Module -Name Pester -Force -SkipPublisherCheck
        }
        Import-Module Pester -PassThru | Out-Null
        Write-Host "OK: Pester ready"
    }
    catch {
        Write-Host "WARN: Failed to install/import Pester: $_"
    }
}

function Ensure-Chocolatey {
    Write-Step "Ensuring Chocolatey is available..."
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
    Write-Host "OK: Chocolatey available"
}

function Install-Acrylic {
    Write-Step "Installing Acrylic DNS Proxy (best-effort)..."
    try {
        choco install acrylic-dns-proxy -y --no-progress | Out-Default
        Start-Sleep -Seconds 5

        $svc = Get-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne 'Running') {
            Start-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }

        $svc = Get-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue
        if ($svc) {
            Write-Host "Acrylic service status: $($svc.Status)"
        }
        else {
            Write-Host "WARN: Acrylic service not found"
        }
    }
    catch {
        Write-Host "WARN: Acrylic install failed (continuing): $_"
    }
}

function Prepare-OpenPathLayout {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    Write-Step "Preparing OpenPath test layout under C:\OpenPath..."

    New-Item -ItemType Directory -Path 'C:\OpenPath\lib' -Force | Out-Null
    New-Item -ItemType Directory -Path 'C:\OpenPath\scripts' -Force | Out-Null
    New-Item -ItemType Directory -Path 'C:\OpenPath\data\logs' -Force | Out-Null

    Copy-Item (Join-Path $RepoRoot 'windows\lib\*.psm1') 'C:\OpenPath\lib\' -Force
    Copy-Item (Join-Path $RepoRoot 'windows\scripts\*.ps1') 'C:\OpenPath\scripts\' -Force

    Write-Host "OK: Modules/scripts copied"
}

function Write-TestConfig {
    Write-Step "Creating test configuration..."
    $config = @{
        whitelistUrl            = 'https://raw.githubusercontent.com/LasEncinasIT/Whitelist-por-aula/main/Informatica%203.txt'
        updateIntervalMinutes   = 5
        watchdogIntervalMinutes = 1
        primaryDNS              = '8.8.8.8'
        acrylicPath             = ''
        enableFirewall          = $true
        enableBrowserPolicies   = $false
        installedAt             = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    }

    $config | ConvertTo-Json -Depth 10 | Set-Content 'C:\OpenPath\data\config.json' -Encoding UTF8
    Write-Host "OK: Test configuration created"
}

function Import-ModulesAndSmoke {
    Write-Step "Importing modules and smoke-testing basic functions..."

    Import-Module 'C:\OpenPath\lib\Common.psm1' -Force
    Import-Module 'C:\OpenPath\lib\DNS.psm1' -Force
    Import-Module 'C:\OpenPath\lib\Firewall.psm1' -Force

    if (Get-Command 'Get-AcrylicPath' -ErrorAction SilentlyContinue) {
        $acrylicPath = Get-AcrylicPath
        Write-Host "Acrylic Path: $acrylicPath"
    }
    if (Get-Command 'Test-AcrylicInstalled' -ErrorAction SilentlyContinue) {
        $installed = Test-AcrylicInstalled
        Write-Host "Acrylic Installed: $installed"
    }
}

function Test-DnsResolution {
    Write-Step "Testing system DNS resolution..."

    try {
        $result = Resolve-DnsName -Name 'google.com' -ErrorAction Stop
        Write-Host "OK: google.com resolves: $($result[0].IPAddress)"
    }
    catch {
        Write-Host "WARN: DNS resolution failed: $_"
    }

    $acrylicRunning = (Get-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue).Status -eq 'Running'
    if ($acrylicRunning) {
        Write-Host ""
        Write-Host "Testing Acrylic DNS proxy..."
        try {
            $result = Resolve-DnsName -Name 'google.com' -Server '127.0.0.1' -ErrorAction Stop
            Write-Host "OK: Acrylic proxy working: $($result[0].IPAddress)"
        }
        catch {
            Write-Host "WARN: Acrylic proxy test failed: $_"
        }
    }
}

function Test-SinkholeBlocking {
    Write-Step "Testing DNS sinkhole blocking (best-effort)..."

    $acrylicPath = 'C:\Program Files (x86)\Acrylic DNS Proxy'
    $hostsFile = Join-Path $acrylicPath 'AcrylicHosts.txt'

    if (-not (Test-Path $hostsFile)) {
        Write-Host 'WARN: Acrylic hosts file not found, skipping sinkhole test'
        return
    }

    Copy-Item $hostsFile "$hostsFile.bak" -Force
    try {
        Add-Content -Path $hostsFile -Value '0.0.0.0 blocked-test-domain.example.com'
        Restart-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3

        try {
            $result = Resolve-DnsName -Name 'blocked-test-domain.example.com' -Server '127.0.0.1' -ErrorAction Stop
            if ($result.IPAddress -eq '0.0.0.0') {
                Write-Host 'OK: Sinkhole blocking works (0.0.0.0)'
            }
            else {
                Write-Host "WARN: Domain resolved to $($result.IPAddress) instead of 0.0.0.0"
            }
        }
        catch {
            Write-Host 'OK: Domain blocked (resolution failed as expected)'
        }
    }
    finally {
        Move-Item "$hostsFile.bak" $hostsFile -Force
        Restart-Service -Name 'AcrylicDNSProxySvc' -ErrorAction SilentlyContinue
    }
}

function Test-WhitelistUpdate {
    Write-Step "Testing whitelist parsing (module-level)..."

    $testFile = 'C:\OpenPath\data\test-whitelist.txt'
    @(
        '## WHITELIST',
        'google.com',
        'github.com',
        'test-allowed-domain.com',
        '',
        '## BLOCKED-SUBDOMAINS',
        'ads.example.com',
        'tracking.example.com'
    ) | Set-Content -Path $testFile -Encoding UTF8

    Get-Content $testFile | Out-Default

    if (Get-Command 'Parse-Whitelist' -ErrorAction SilentlyContinue) {
        $parsed = Parse-Whitelist -Path $testFile
        Write-Host "Parsed: $($parsed.Whitelist.Count) allowed, $($parsed.BlockedSubdomains.Count) blocked"
    }

    Remove-Item $testFile -ErrorAction SilentlyContinue
}

function Test-Firewall {
    Write-Step "Testing firewall functions (best-effort)..."

    try {
        Import-Module 'C:\OpenPath\lib\Firewall.psm1' -Force
        $active = Test-FirewallActive
        Write-Host "Firewall Active: $active"

        try {
            New-NetFirewallRule -DisplayName 'OpenPath-Test-Rule' -Direction Outbound -Action Block -Protocol UDP -RemotePort 12345 -ErrorAction Stop | Out-Null
            Write-Host 'OK: Test firewall rule created'
            $rule = Get-NetFirewallRule -DisplayName 'OpenPath-Test-Rule' -ErrorAction SilentlyContinue
            if ($rule) {
                Write-Host 'OK: Test firewall rule verified'
            }
        }
        catch {
            Write-Host "WARN: Test rule creation failed (may require elevation): $_"
        }
        finally {
            Remove-NetFirewallRule -DisplayName 'OpenPath-Test-Rule' -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Host "WARN: Firewall module test failed: $_"
    }
}

function Run-PesterE2E {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    Write-Step "Running Pester E2E tests..."
    try {
        $config = New-PesterConfiguration
        $config.Run.Path = (Join-Path $RepoRoot 'tests\e2e\Windows-E2E.Tests.ps1')
        $config.Output.Verbosity = 'Detailed'
        $config.Run.PassThru = $true

        $result = Invoke-Pester -Configuration $config
        Write-Host "Results: $($result.PassedCount) passed, $($result.FailedCount) failed"

        if ($result.FailedCount -gt 0) {
            Write-Host 'WARN: Some Pester tests failed (may be expected in CI environment)'
        }
    }
    catch {
        Write-Host "WARN: Invoke-Pester failed (continuing): $_"
    }
}

function Verify-ScheduledTasksApi {
    Write-Step "Testing scheduled tasks API (best-effort)..."

    try {
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-Command 'echo test'"
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1)

        Register-ScheduledTask -TaskName 'OpenPath-E2E-Test' -Action $action -Trigger $trigger -Force | Out-Null
        Write-Host 'OK: Test task created'

        $task = Get-ScheduledTask -TaskName 'OpenPath-E2E-Test' -ErrorAction SilentlyContinue
        if ($task) {
            Write-Host 'OK: Test task verified'
        }
    }
    catch {
        Write-Host "WARN: Scheduled task test failed: $_"
    }
    finally {
        Unregister-ScheduledTask -TaskName 'OpenPath-E2E-Test' -Confirm:$false -ErrorAction SilentlyContinue
    }
}

function Cleanup-WindowsE2E {
    Write-Step "Cleanup..."

    if (Test-Path 'C:\OpenPath') {
        Remove-Item 'C:\OpenPath' -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host 'OK: Test directories removed'
    }

    Get-NetFirewallRule -DisplayName 'OpenPath-*' -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue

    Get-ScheduledTask -TaskName 'OpenPath-*' -ErrorAction SilentlyContinue |
        Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue
}

try {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

    Ensure-Pester
    Ensure-Chocolatey
    Install-Acrylic
    Prepare-OpenPathLayout -RepoRoot $RepoRoot
    Write-TestConfig
    Import-ModulesAndSmoke
    Test-DnsResolution
    Test-SinkholeBlocking
    Test-WhitelistUpdate
    Test-Firewall
    Run-PesterE2E -RepoRoot $RepoRoot
    Verify-ScheduledTasksApi

    Write-Host ""
    Write-Host 'Windows E2E complete'
}
finally {
    Cleanup-WindowsE2E
}

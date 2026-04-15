# OpenPath - Strict Internet Access Control
# Copyright (C) 2025 OpenPath Authors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Updates the OpenPath whitelist from remote URL and applies all configurations
.DESCRIPTION
    Downloads whitelist, updates Acrylic DNS hosts, configures firewall,
    and applies browser policies.
#>

$ErrorActionPreference = "Stop"
$OpenPathRoot = "C:\OpenPath"
$script:UpdateMutexName = "Global\OpenPathUpdateLock"

# Initialize standalone script session via the shared bootstrap helper.
Import-Module "$OpenPathRoot\lib\ScriptBootstrap.psm1" -Force
. (Join-Path $OpenPathRoot 'lib\internal\Update.Script.Config.ps1')
. (Join-Path $OpenPathRoot 'lib\internal\Update.Script.Apply.ps1')
. (Join-Path $OpenPathRoot 'lib\internal\Update.Script.Rollback.ps1')
Initialize-OpenPathScriptSession `
    -OpenPathRoot $OpenPathRoot `
    -DependentModules @('DNS', 'Firewall', 'Browser') `
    -RequiredCommands @(
    'Write-OpenPathLog',
    'Get-OpenPathConfig',
    'Get-OpenPathFileAgeHours',
    'Get-HostFromUrl',
    'Get-OpenPathFromUrl',
    'Get-OpenPathRuntimeHealth',
    'Get-ValidWhitelistDomainsFromFile',
    'ConvertTo-OpenPathWhitelistFileContent',
    'Restore-OpenPathLatestCheckpoint',
    'Restore-OpenPathProtectedMode',
    'Save-OpenPathWhitelistCheckpoint',
    'Send-OpenPathHealthReport',
    'Sync-OpenPathFirefoxNativeHostState',
    'Update-AcrylicHost',
    'Restore-OriginalDNS',
    'Remove-OpenPathFirewall',
    'Remove-BrowserPolicy',
    'Set-AllBrowserPolicy'
) `
    -ScriptName 'Update-OpenPath.ps1' | Out-Null
Import-Module "$OpenPathRoot\lib\Update.Runtime.psm1" -Force

$mutex = $null
$lockAcquired = $false
$shouldRunUpdate = $true
$exitCode = 0
$whitelistPath = "$OpenPathRoot\data\whitelist.txt"
$backupPath = "$OpenPathRoot\data\whitelist.backup.txt"
$staleFailsafeStatePath = "$OpenPathRoot\data\stale-failsafe-state.json"

try {
    $mutex = [System.Threading.Mutex]::new($false, $script:UpdateMutexName)
    try {
        $lockAcquired = $mutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $lockAcquired = $true
        Write-OpenPathLog "OpenPath update lock was abandoned by a previous process - continuing" -Level WARN
    }

    if (-not $lockAcquired) {
        Write-OpenPathLog "Another OpenPath update is already running - skipping this cycle" -Level WARN
        $shouldRunUpdate = $false
    }

    if ($shouldRunUpdate) {
        Write-OpenPathLog "=== Starting openpath update ==="

        $config = Get-OpenPathConfig
        $updateSettings = Get-OpenPathUpdatePolicySettings -Config $config
        Backup-OpenPathWhitelistState `
            -WhitelistPath $whitelistPath `
            -BackupPath $backupPath `
            -EnableCheckpointRollback $updateSettings.EnableCheckpointRollback `
            -MaxCheckpoints $updateSettings.MaxCheckpoints

        $downloadResult = Get-OpenPathWhitelistDownloadResult -Config $config

        if ($downloadResult.DownloadFailed) {
            Handle-OpenPathDownloadFailure `
                -Config $config `
                -WhitelistPath $whitelistPath `
                -StaleFailsafeStatePath $staleFailsafeStatePath `
                -StaleWhitelistMaxAgeHours $updateSettings.StaleWhitelistMaxAgeHours `
                -EnableStaleFailsafe $updateSettings.EnableStaleFailsafe
        }
        elseif ($downloadResult.Whitelist.PSObject.Properties['NotModified'] -and $downloadResult.Whitelist.NotModified) {
            Handle-OpenPathNotModified -Config $config -WhitelistPath $whitelistPath
        }
        elseif ($downloadResult.Whitelist.IsDisabled) {
            Handle-OpenPathDisabledWhitelist `
                -Config $config `
                -WhitelistPath $whitelistPath `
                -StaleFailsafeStatePath $staleFailsafeStatePath
        }
        else {
            Handle-OpenPathWhitelistApply `
                -Config $config `
                -Whitelist $downloadResult.Whitelist `
                -WhitelistPath $whitelistPath `
                -StaleFailsafeStatePath $staleFailsafeStatePath
        }
    }
}
catch {
    Write-UpdateCatchLog "Update failed: $_" -Level ERROR
    $rollbackResult = Invoke-OpenPathUpdateRollback `
        -Config $config `
        -WhitelistPath $whitelistPath `
        -BackupPath $backupPath `
        -StaleFailsafeStatePath $staleFailsafeStatePath
    Send-OpenPathUpdateFailureHealth `
        -RollbackSucceeded $rollbackResult.RollbackSucceeded `
        -RollbackMethod $rollbackResult.RollbackMethod

    $exitCode = 1
}
finally {
    if ($lockAcquired -and $mutex) {
        try {
            $mutex.ReleaseMutex()
        }
        catch [System.ApplicationException] {
            # Ignore if mutex ownership was not held at release time
        }
    }

    if ($mutex) {
        $mutex.Dispose()
    }
}

exit $exitCode

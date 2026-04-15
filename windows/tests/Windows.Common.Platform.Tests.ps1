Describe "Platform script composition" {
    It "Routes update runtime helpers through the shared module" {
        $updateScriptPath = Join-Path $PSScriptRoot ".." "scripts" "Update-OpenPath.ps1"
        $content = Get-Content $updateScriptPath -Raw

        Assert-ContentContainsAll -Content $content -Needles @(
            'Import-Module "$OpenPathRoot\lib\Update.Runtime.psm1" -Force',
            'Clear-StaleFailsafeState',
            'Enter-StaleWhitelistFailsafe',
            'Restore-OpenPathCheckpoint',
            'Write-UpdateCatchLog',
            'Sync-FirefoxNativeHostMirror'
        )
    }
}

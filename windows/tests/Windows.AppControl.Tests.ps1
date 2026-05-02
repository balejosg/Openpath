Import-Module (Join-Path $PSScriptRoot "TestHelpers.psm1") -Force

$modulePath = Join-Path $PSScriptRoot ".." "lib"
Import-Module "$modulePath\AppControl.psm1" -Force -Global -ErrorAction Stop

Describe "AppControl Module" {
    Context "New-OpenPathNonAdminAppLockerPolicySpec" {
        It "Targets all non-admin users while preserving administrators, SYSTEM, and OpenPath native host" {
            $spec = New-OpenPathNonAdminAppLockerPolicySpec -OpenPathRoot 'C:\OpenPath'

            $spec.NonAdminSid | Should -Be 'S-1-5-32-545'
            $spec.AdminSid | Should -Be 'S-1-5-32-544'
            $spec.SystemSid | Should -Be 'S-1-5-18'
            $spec.Mode | Should -Be 'Enforced'
            @($spec.AllowPaths) | Should -Contain '%WINDIR%\*'
            @($spec.AllowPaths) | Should -Contain '%PROGRAMFILES%\*'
            @($spec.AllowPaths) | Should -Contain '%PROGRAMFILES(X86)%\*'
            @($spec.AllowPaths) | Should -Contain 'C:\OpenPath\browser-extension\firefox\native\*'
            @($spec.BlockedWindowsTools) | Should -Contain '%WINDIR%\System32\curl.exe'
            @($spec.BlockedWindowsTools) | Should -Contain '%WINDIR%\System32\nslookup.exe'
            @($spec.UserWritableDenyPaths) | Should -Contain '%USERPROFILE%\Downloads\*'
            @($spec.UserWritableDenyPaths) | Should -Contain '%LOCALAPPDATA%\Temp\*'
        }

        It "Supports AuditOnly mode without changing the target group" {
            $spec = New-OpenPathNonAdminAppLockerPolicySpec -OpenPathRoot 'C:\OpenPath' -Mode 'AuditOnly'

            $spec.Mode | Should -Be 'AuditOnly'
            $spec.NonAdminSid | Should -Be 'S-1-5-32-545'
        }
    }
}

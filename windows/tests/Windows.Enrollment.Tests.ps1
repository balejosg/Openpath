Import-Module (Join-Path $PSScriptRoot "TestHelpers.psm1") -Force

Describe "Enrollment script" {
    Context "Token modes" {
        It "Supports registration and enrollment token parameters" {
            $scriptPath = Join-Path $PSScriptRoot ".." "scripts" "Enroll-Machine.ps1"
            $content = Get-Content $scriptPath -Raw

            Assert-ContentContainsAll -Content $content -Needles @(
                '[string]$EnrollmentToken = ""',
                '[string]$ClassroomId = ""',
                '[switch]$Unattended',
                'RegistrationToken and EnrollmentToken cannot be used together',
                'ClassroomId requires EnrollmentToken mode',
                'New-OpenPathMachineRegistrationBody',
                'Resolve-OpenPathMachineRegistration'
            )
        }
    }

    Context "Firefox native host sync" {
        It "Registers the Firefox native host after persisting enrollment config" {
            $scriptPath = Join-Path $PSScriptRoot ".." "scripts" "Enroll-Machine.ps1"
            $content = Get-Content $scriptPath -Raw

            Assert-ContentContainsAll -Content $content -Needles @(
                '$BrowserModulePath = "$OpenPathRoot\lib\Browser.psm1"',
                'Import-Module $BrowserModulePath -Force',
                'Register-OpenPathFirefoxNativeHost -Config $config -ClearWhitelist | Out-Null',
                'Failed to register Firefox native host after enrollment'
            )
        }
    }
}

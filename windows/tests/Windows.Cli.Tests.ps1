Describe "Operational Command Script" {
    Context "Script existence" {
        It "OpenPath.ps1 exists" {
            $scriptPath = Join-Path $PSScriptRoot ".." "OpenPath.ps1"
            Test-Path $scriptPath | Should -BeTrue
        }
    }

    Context "Command routing" {
        It "Routes key commands through a unified dispatcher" {
            $scriptPath = Join-Path $PSScriptRoot ".." "OpenPath.ps1"
            $content = Get-Content $scriptPath -Raw

            $content.Contains('switch ($commandName)') | Should -BeTrue
            $content.Contains("'status'") | Should -BeTrue
            $content.Contains("'update'") | Should -BeTrue
            $content.Contains("'health'") | Should -BeTrue
            $content.Contains("'self-update'") | Should -BeTrue
            $content.Contains("'enroll'") | Should -BeTrue
            $content.Contains("'rotate-token'") | Should -BeTrue
            $content.Contains("'restart'") | Should -BeTrue
            $content.Contains('Show-OpenPathStatus') | Should -BeTrue
            $content.Contains('Invoke-OpenPathAgentSelfUpdate') | Should -BeTrue
            $content.Contains('Enroll-Machine.ps1') | Should -BeTrue
        }
    }

    Context "Argument forwarding" {
        It "Normalizes named arguments before invoking child scripts" {
            $scriptPath = Join-Path $PSScriptRoot ".." "OpenPath.ps1"
            $content = Get-Content $scriptPath -Raw

            Assert-ContentContainsAll -Content $content -Needles @(
                'function ConvertTo-OpenPathInvocationSplat',
                '$namedArguments = @{}',
                '& $ScriptPath @namedArguments @positionalArguments'
            )
            $content.Contains('& $ScriptPath @ScriptArguments') | Should -BeFalse
        }
    }

    Context "DNS probe selection" {
        It "Uses the shared probe selection instead of hard-coding google.com" {
            $scriptPath = Join-Path $PSScriptRoot ".." "OpenPath.ps1"
            $content = Get-Content $scriptPath -Raw

            $content.Contains("Test-DNSResolution -Domain 'google.com'") | Should -BeFalse
            $content.Contains('Test-DNSResolution)') | Should -BeTrue
        }
    }
}


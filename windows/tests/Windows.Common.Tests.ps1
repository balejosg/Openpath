Describe "Common Module" {
    BeforeAll {
        $modulePath = Join-Path $PSScriptRoot ".." "lib"
        Import-Module (Join-Path $modulePath "Common.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "DNS.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "Firewall.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "Services.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "Browser.Common.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "Browser.psm1") -Force -Global -ErrorAction Stop
        Import-Module (Join-Path $modulePath "Browser.FirefoxNativeHost.psm1") -Force -Global -ErrorAction Stop
    }

    Context "Test-AdminPrivileges" {
        It "Returns a boolean value" {
            $result = InModuleScope Common {
                Test-AdminPrivileges
            }
            $result | Should -BeOfType [bool]
        }
    }

    Context "Write-OpenPathLog" {
        It "Writes INFO level logs" {
            {
                InModuleScope Common {
                    Write-OpenPathLog -Message "Test INFO message" -Level INFO
                }
            } | Should -Not -Throw
        }

        It "Writes WARN level logs" {
            {
                InModuleScope Common {
                    Write-OpenPathLog -Message "Test WARN message" -Level WARN
                }
            } | Should -Not -Throw
        }

        It "Writes ERROR level logs" {
            {
                InModuleScope Common {
                    Write-OpenPathLog -Message "Test ERROR message" -Level ERROR
                }
            } | Should -Not -Throw
        }

        It "Includes PID in log entries" {
            $logPath = "C:\OpenPath\data\logs\openpath.log"
            if (Test-Path $logPath) {
                InModuleScope Common {
                    Write-OpenPathLog -Message "PID test entry" -Level INFO
                }
                $lastLine = Get-Content $logPath -Tail 1
                $lastLine | Should -Match "\[PID:\d+\]"
            }
        }
    }

    Context "Get-PrimaryDNS" {
        It "Returns a valid IP address string" {
            $dns = InModuleScope Common {
                Get-PrimaryDNS
            }
            $dns | Should -Not -BeNullOrEmpty
            $dns | Should -Match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
        }
    }

    Context "HTTP compatibility" {
        It "Loads System.Net.Http types for standalone whitelist downloads" {
            InModuleScope Common {
                { Ensure-OpenPathHttpAssembly } | Should -Not -Throw
                ('System.Net.Http.HttpClientHandler' -as [type]) | Should -Not -BeNullOrEmpty
            }
        }
    }

    Context "Get-OpenPathRuntimeHealth" {
        It "Returns runtime health object with expected boolean properties" {
            $health = InModuleScope Common {
                Get-OpenPathRuntimeHealth
            }

            $health | Should -Not -BeNullOrEmpty
            $health.PSObject.Properties.Name | Should -Contain 'DnsServiceRunning'
            $health.PSObject.Properties.Name | Should -Contain 'DnsResolving'
            $health.DnsServiceRunning | Should -BeOfType [bool]
            $health.DnsResolving | Should -BeOfType [bool]
        }
    }

    Context "Protected mode helpers" {
        It "Defines Restore-OpenPathProtectedMode with optional Acrylic restart" {
            $commonPath = Join-Path $PSScriptRoot ".." "lib" "Common.psm1"
            $domainsHelperPath = Join-Path $PSScriptRoot ".." "lib" "internal" "Common.Domains.ps1"
            $content = Get-Content $domainsHelperPath -Raw

            Assert-ContentContainsAll -Content $content -Needles @(
                'function Restore-OpenPathProtectedMode',
                '[switch]$SkipAcrylicRestart',
                'Restart-AcrylicService',
                'Set-LocalDNS',
                'Set-OpenPathFirewall',
                'Enable-OpenPathFirewall'
            )
        }

        It "Reuses Restore-OpenPathProtectedMode during checkpoint restore" {
            $whitelistHelperPath = Join-Path $PSScriptRoot ".." "lib" "internal" "Common.Whitelist.ps1"
            $content = Get-Content $whitelistHelperPath -Raw

            $content | Should -Match '(?s)function Restore-OpenPathLatestCheckpoint.*?Restore-OpenPathProtectedMode -Config \$Config'
        }
    }

    Context "Get-OpenPathDnsProbeDomains" {
        It "Prefers cached whitelist domains before protected fallbacks" {
            $expectedWhitelistPath = 'C:\OpenPath\data\whitelist.txt'

            Mock Test-Path { $true } -ModuleName Common -ParameterFilter { $Path -eq $expectedWhitelistPath }
            Mock Get-ValidWhitelistDomainsFromFile { @('safe.example', 'allowed.example') } -ModuleName Common
            Mock Get-OpenPathProtectedDomains { @('raw.githubusercontent.com', 'api.example.com') } -ModuleName Common

            InModuleScope Common {
                $domains = @(Get-OpenPathDnsProbeDomains)

                $domains[0] | Should -Be 'safe.example'
                $domains[1] | Should -Be 'allowed.example'
                $domains | Should -Contain 'raw.githubusercontent.com'
                $domains | Should -Contain 'api.example.com'
            }
        }
    }

    Context "Machine identity helpers" {
        It "Canonicalizes machine names" {
            (InModuleScope Common {
                ConvertTo-OpenPathMachineName -Value 'PC 01__Lab'
            }) | Should -Be 'pc-01-lab'
        }

        It "Builds classroom-scoped machine names" {
            $scoped = InModuleScope Common {
                New-OpenPathScopedMachineName -Hostname 'PC 01__Lab' -ClassroomId 'classroom-123'
            }
            $scoped | Should -Match '^pc-01-lab-[a-f0-9]{8}$'
            $scoped.Length | Should -BeLessOrEqual 63
        }

        It "Builds canonical registration payloads" {
            $body = InModuleScope Common {
                New-OpenPathMachineRegistrationBody -MachineName 'pc-01-abcd1234' -Version '4.1.0' -ClassroomId 'classroom-123'
            }
            $body.hostname | Should -Be 'pc-01-abcd1234'
            $body.version | Should -Be '4.1.0'
            $body.classroomId | Should -Be 'classroom-123'
            $body.PSObject.Properties.Name | Should -Not -Contain 'classroomName'
        }

        It "Resolves registration responses with server-issued machine names" {
            $registration = InModuleScope Common {
                Resolve-OpenPathMachineRegistration `
                    -Response ([PSCustomObject]@{
                        success = $true
                        whitelistUrl = 'https://api.example.com/w/token/whitelist.txt'
                        classroomName = 'Room 101'
                        classroomId = 'classroom-123'
                        machineHostname = 'pc-01-abcd1234'
                    }) `
                    -MachineName 'pc-01-lab' `
                    -Classroom 'Room Local' `
                    -ClassroomId 'fallback-id'
            }

            $registration.WhitelistUrl | Should -Be 'https://api.example.com/w/token/whitelist.txt'
            $registration.Classroom | Should -Be 'Room 101'
            $registration.ClassroomId | Should -Be 'classroom-123'
            $registration.MachineName | Should -Be 'pc-01-abcd1234'
        }
    }

    Context "Self-update helpers" {
        It "Extracts machine token from whitelist URL" {
            $token = InModuleScope Common {
                Get-OpenPathMachineTokenFromWhitelistUrl -WhitelistUrl "https://api.example.com/w/abc123token/whitelist.txt"
            }
            $token | Should -Be 'abc123token'
        }

        It "Builds protected domains from configured control-plane URLs and bootstrap hosts" {
            Mock Get-OpenPathConfig {
                [PSCustomObject]@{
                    apiUrl = 'https://control.example'
                    whitelistUrl = 'https://downloads.example/w/token/whitelist.txt'
                }
            } -ModuleName Common

            $domains = InModuleScope Common {
                Get-OpenPathProtectedDomains
            }

            $domains | Should -Contain 'control.example'
            $domains | Should -Contain 'downloads.example'
            $domains | Should -Contain 'raw.githubusercontent.com'
            $domains | Should -Contain 'api.github.com'
            $domains | Should -Contain 'release-assets.githubusercontent.com'
            $domains | Should -Contain 'sourceforge.net'
            $domains | Should -Contain 'downloads.sourceforge.net'
        }

        It "Compares versions correctly" {
            (InModuleScope Common {
                Compare-OpenPathVersion -CurrentVersion '4.1.0' -TargetVersion '4.2.0'
            }) | Should -BeLessThan 0
            (InModuleScope Common {
                Compare-OpenPathVersion -CurrentVersion '4.2.0' -TargetVersion '4.2.0'
            }) | Should -Be 0
            (InModuleScope Common {
                Compare-OpenPathVersion -CurrentVersion '4.3.0' -TargetVersion '4.2.0'
            }) | Should -BeGreaterThan 0
        }
    }

    Context "Get-ValidWhitelistDomainsFromFile" {
        It "Returns valid domains and ignores invalid entries" {
            $tempFile = Join-Path $env:TEMP ("openpath-domains-" + [Guid]::NewGuid().ToString() + ".txt")

            try {
                @(
                    'google.com',
                    'example.org',
                    'not-a-domain',
                    'bad..domain.com',
                    '# comment',
                    ''
                ) | Set-Content $tempFile -Encoding UTF8

                $domains = InModuleScope Common -Parameters @{
                    TempFile = $tempFile
                } {
                    Get-ValidWhitelistDomainsFromFile -Path $TempFile
                }

                $domains | Should -Contain 'google.com'
                $domains | Should -Contain 'example.org'
                $domains | Should -Not -Contain 'not-a-domain'
                $domains | Should -Not -Contain 'bad..domain.com'
            }
            finally {
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }
        }

        It "Returns an empty array when file does not exist" {
            $missingPath = Join-Path $env:TEMP ([Guid]::NewGuid().ToString() + '.txt')
            $domains = InModuleScope Common -Parameters @{
                MissingPath = $missingPath
            } {
                Get-ValidWhitelistDomainsFromFile -Path $MissingPath
            }
            @($domains).Count | Should -Be 0
        }
    }

    Context "Get-OpenPathWhitelistSectionsFromFile" {
        It "Parses whitelist sections from a local whitelist file" {
            $tempFile = Join-Path $env:TEMP ("openpath-whitelist-sections-" + [Guid]::NewGuid().ToString() + ".txt")

            try {
                @'
#DESACTIVADO
## WHITELIST
allowed.example

## BLOCKED-SUBDOMAINS
ads.allowed.example

## BLOCKED-PATHS
allowed.example/private
'@ | Set-Content $tempFile -Encoding UTF8

                $sections = InModuleScope Common -Parameters @{
                    TempFile = $tempFile
                } {
                    Get-OpenPathWhitelistSectionsFromFile -Path $TempFile
                }

                $sections.IsDisabled | Should -BeTrue
                $sections.Whitelist | Should -Contain 'allowed.example'
                $sections.BlockedSubdomains | Should -Contain 'ads.allowed.example'
                $sections.BlockedPaths | Should -Contain 'allowed.example/private'
            }
            finally {
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }
        }

        It "Returns empty sections when file does not exist" {
            $missingPath = Join-Path $env:TEMP ([Guid]::NewGuid().ToString() + '.txt')
            $sections = InModuleScope Common -Parameters @{
                MissingPath = $missingPath
            } {
                Get-OpenPathWhitelistSectionsFromFile -Path $MissingPath
            }

            $sections.IsDisabled | Should -BeFalse
            @($sections.Whitelist).Count | Should -Be 0
            @($sections.BlockedSubdomains).Count | Should -Be 0
            @($sections.BlockedPaths).Count | Should -Be 0
        }
    }

    Context "ConvertTo-OpenPathWhitelistFileContent" {
        It "Serializes whitelist, blocked subdomains, and blocked paths sections" {
            $content = InModuleScope Common {
                ConvertTo-OpenPathWhitelistFileContent `
                    -Whitelist @('allowed.example') `
                    -BlockedSubdomains @('ads.allowed.example') `
                    -BlockedPaths @('allowed.example/private')
            }

            Assert-ContentContainsAll -Content $content -Needles @(
                '## WHITELIST',
                'allowed.example',
                '## BLOCKED-SUBDOMAINS',
                'ads.allowed.example',
                '## BLOCKED-PATHS',
                'allowed.example/private'
            )
        }
    }

    Context "Get-HostFromUrl" {
        It "Returns host for a valid URL" {
            $parsedHost = InModuleScope Common {
                Get-HostFromUrl -Url 'https://api.example.com/path?x=1'
            }
            $parsedHost | Should -Be 'api.example.com'
        }

        It "Returns null for invalid URL" {
            $parsedHost = InModuleScope Common {
                Get-HostFromUrl -Url 'not-a-valid-url'
            }
            $parsedHost | Should -BeNullOrEmpty
        }

        It "Returns null for empty URL" {
            $parsedHost = InModuleScope Common {
                Get-HostFromUrl -Url ''
            }
            $parsedHost | Should -BeNullOrEmpty
        }
    }

    Context "Test-OpenPathDomainFormat" {
        It "Accepts syntactically valid domains" {
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain 'google.com' }) | Should -BeTrue
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain 'sub.example.org' }) | Should -BeTrue
        }

        It "Rejects invalid domain values" {
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain 'invalid domain' }) | Should -BeFalse
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain 'bad..domain.com' }) | Should -BeFalse
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain '-bad.example.com' }) | Should -BeFalse
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain '' }) | Should -BeFalse
            (InModuleScope Common { Test-OpenPathDomainFormat -Domain $null }) | Should -BeFalse
        }

        It "Matches shared domain contract fixtures" {
            $validDomains = Get-ContractFixtureLines -FileName 'domain-valid.txt'
            foreach ($domain in $validDomains) {
                (InModuleScope Common -Parameters @{ Domain = $domain } {
                    Test-OpenPathDomainFormat -Domain $Domain
                }) | Should -BeTrue
            }

            $invalidDomains = Get-ContractFixtureLines -FileName 'domain-invalid.txt'
            foreach ($domain in $invalidDomains) {
                (InModuleScope Common -Parameters @{ Domain = $domain } {
                    Test-OpenPathDomainFormat -Domain $Domain
                }) | Should -BeFalse
            }
        }
    }

    Context "Get-OpenPathFromUrl" {
        It "Throws when URL is invalid" {
            { Get-OpenPathFromUrl -Url "https://invalid.example.com/404" } | Should -Throw
        }
    }

    Context "Test-InternetConnection" {
        It "Returns a boolean value" {
            $result = InModuleScope Common {
                Test-InternetConnection
            }
            $result | Should -BeOfType [bool]
        }
    }
}

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

Describe "Common Module - Mocked Tests" {
    BeforeAll {
        $modulePath = Join-Path $PSScriptRoot ".." "lib"
        Import-Module "$modulePath\Common.psm1" -Force
    }

    Context "Get-OpenPathFromUrl parsing" {
        It "Parses whitelist sections correctly" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{
                    StatusCode = 200
                    Content    = "domain1.com`ndomain2.com`ndomain3.com`n## BLOCKED-SUBDOMAINS`nbad.domain.com`n## BLOCKED-PATHS`n/blocked/path"
                    ETag       = $null
                }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.Whitelist.Count | Should -BeGreaterOrEqual 3
            $result.Whitelist[0] | Should -Be "domain1.com"
            $result.Whitelist | Should -Contain "domain2.com"
            $result.Whitelist | Should -Contain "domain3.com"
            $result.BlockedSubdomains | Should -HaveCount 1
            $result.BlockedSubdomains[0] | Should -Be "bad.domain.com"
            $result.BlockedPaths | Should -HaveCount 1
        }

        It "Detects #DESACTIVADO marker" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{ StatusCode = 200; Content = "#DESACTIVADO`ndomain1.com`ndomain2.com`ndomain3.com"; ETag = $null }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.IsDisabled | Should -BeTrue
        }

        It "Accepts disabled whitelist even without minimum domains" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{ StatusCode = 200; Content = "#DESACTIVADO"; ETag = $null }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.IsDisabled | Should -BeTrue
            $result.Whitelist | Should -HaveCount 0
        }

        It "Skips comment lines and empty lines" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{
                    StatusCode = 200
                    Content    = "# comment`n`ndomain1.com`ndomain2.com`ndomain3.com`n# another comment"
                    ETag       = $null
                }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.Whitelist.Count | Should -BeGreaterOrEqual 3
            $result.Whitelist | Should -Contain "domain1.com"
            $result.Whitelist | Should -Contain "domain2.com"
            $result.Whitelist | Should -Contain "domain3.com"
        }

        It "Accepts structured whitelist with a single valid domain" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{
                    StatusCode = 200
                    Content    = "## WHITELIST`nsingle-domain.example"
                    ETag       = $null
                }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.IsDisabled | Should -BeFalse
            $result.Whitelist.Count | Should -BeGreaterOrEqual 1
            $result.Whitelist | Should -Contain "single-domain.example"
        }

        It "Falls back to protected domains when whitelist has insufficient valid domains" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{ StatusCode = 200; Content = "not-a-domain"; ETag = $null }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.Whitelist.Count | Should -BeGreaterOrEqual 1
            $result.Whitelist | Should -Contain "github.com"
            $result.Whitelist | Should -Not -Contain "not-a-domain"
        }

        It "Handles empty response content by retaining protected domains" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{ StatusCode = 200; Content = ""; ETag = $null }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.Whitelist.Count | Should -BeGreaterOrEqual 1
            $result.Whitelist | Should -Contain "github.com"
        }

        It "Returns a detectable NotModified property when the whitelist ETag matches" {
            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{ StatusCode = 304; Content = ""; ETag = '"etag-123"' }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"
            $result.PSObject.Properties['NotModified'] | Should -Not -BeNullOrEmpty
            $result.NotModified | Should -BeTrue
            $result.Whitelist | Should -HaveCount 0
        }

        It "Protects control-plane hosts from blocked sections and injects them into the effective whitelist" {
            Mock Get-OpenPathConfig {
                [PSCustomObject]@{
                    apiUrl = 'https://control.example'
                    whitelistUrl = 'https://downloads.example/w/token/whitelist.txt'
                }
            } -ModuleName Common

            Mock Invoke-OpenPathHttpGetText {
                [PSCustomObject]@{
                    StatusCode = 200
                    Content = @"
safe.example
## BLOCKED-SUBDOMAINS
control.example
## BLOCKED-PATHS
downloads.example/blocked
"@
                    ETag = $null
                }
            } -ModuleName Common

            $result = Get-OpenPathFromUrl -Url "http://test.example.com/whitelist.txt"

            $result.Whitelist | Should -Contain 'safe.example'
            $result.Whitelist | Should -Contain 'control.example'
            $result.Whitelist | Should -Contain 'downloads.example'
            $result.BlockedSubdomains | Should -Not -Contain 'control.example'
            $result.BlockedPaths | Should -Not -Contain 'downloads.example/blocked'
        }
    }

    Context "Get-PrimaryDNS with mocked network" {
        It "Returns DNS from adapter when available" {
            Mock Get-DnsClientServerAddress {
                @([PSCustomObject]@{ ServerAddresses = @("192.168.1.1") })
            } -ModuleName Common
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '192.168.1.1' }

            $dns = Get-PrimaryDNS
            $dns | Should -Be "192.168.1.1"
        }

        It "Falls back to gateway when no DNS adapter found" {
            Mock Get-DnsClientServerAddress { @() } -ModuleName Common
            Mock Get-NetRoute {
                @([PSCustomObject]@{ NextHop = "10.0.0.1" })
            } -ModuleName Common
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '10.0.0.1' }

            $dns = Get-PrimaryDNS
            $dns | Should -Be "10.0.0.1"
        }

        It "Falls back to a public resolver when adapter DNS cannot answer direct queries" {
            Mock Get-DnsClientServerAddress {
                @([PSCustomObject]@{ ServerAddresses = @("168.63.129.16") })
            } -ModuleName Common
            Mock Get-NetRoute { @() } -ModuleName Common
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common -ParameterFilter { $Server -eq '168.63.129.16' }
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '8.8.8.8' }

            $dns = Get-PrimaryDNS
            $dns | Should -Be "8.8.8.8"
        }

        It "De-prioritizes platform-managed resolvers when a public fallback also works" {
            Mock Get-DnsClientServerAddress {
                @([PSCustomObject]@{ ServerAddresses = @("168.63.129.16") })
            } -ModuleName Common
            Mock Get-NetRoute { @() } -ModuleName Common
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '168.63.129.16' }
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '8.8.8.8' }

            $dns = Get-PrimaryDNS
            $dns | Should -Be "8.8.8.8"
        }

        It "Still uses a platform-managed resolver when fallbacks are unreachable" {
            Mock Get-DnsClientServerAddress {
                @([PSCustomObject]@{ ServerAddresses = @("168.63.129.16") })
            } -ModuleName Common
            Mock Get-NetRoute { @() } -ModuleName Common
            Mock Resolve-DnsName { @([PSCustomObject]@{ IPAddress = '142.250.184.14' }) } -ModuleName Common -ParameterFilter { $Server -eq '168.63.129.16' }
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common -ParameterFilter { $Server -eq '8.8.8.8' }
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common -ParameterFilter { $Server -eq '1.1.1.1' }
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common -ParameterFilter { $Server -eq '9.9.9.9' }
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common -ParameterFilter { $Server -eq '8.8.4.4' }

            $dns = Get-PrimaryDNS
            $dns | Should -Be "168.63.129.16"
        }

        It "Falls back to 8.8.8.8 as ultimate default" {
            Mock Get-DnsClientServerAddress { @() } -ModuleName Common
            Mock Get-NetRoute { @() } -ModuleName Common
            Mock Resolve-DnsName { throw 'unreachable' } -ModuleName Common

            $dns = Get-PrimaryDNS
            $dns | Should -Be "8.8.8.8"
        }
    }

    Context "Send-OpenPathHealthReport" {
        It "Posts health reports to the tRPC endpoint with expected payload fields" {
            $script:capturedUri = $null
            $script:capturedHeaders = $null
            $script:capturedBody = $null

            Mock Get-OpenPathConfig {
                [PSCustomObject]@{
                    apiUrl = 'https://api.example.com'
                    whitelistUrl = 'https://api.example.com/w/token123/whitelist.txt'
                    version = '4.1.0'
                }
            } -ModuleName Common

            Mock Invoke-RestMethod {
                param(
                    [string]$Uri,
                    [string]$Method,
                    [hashtable]$Headers,
                    [string]$Body
                )

                $script:capturedUri = $Uri
                $script:capturedHeaders = $Headers
                $script:capturedBody = $Body

                return @{ result = @{ data = @{ json = @{ ok = $true } } } }
            } -ModuleName Common

            $result = Send-OpenPathHealthReport -Status 'DEGRADED' -DnsServiceRunning:$true -DnsResolving:$false -FailCount 2 -Actions 'watchdog_repair' -Version '4.1.0'
            $result | Should -BeTrue

            $script:capturedUri | Should -Be 'https://api.example.com/trpc/healthReports.submit'
            $script:capturedHeaders['Authorization'] | Should -Be 'Bearer token123'

            $payload = $script:capturedBody | ConvertFrom-Json
            $payload.json.status | Should -Be 'DEGRADED'
            $payload.json.hostname | Should -Not -BeNullOrEmpty
            $payload.json.dnsmasqRunning | Should -BeTrue
            $payload.json.dnsResolving | Should -BeFalse
            $payload.json.failCount | Should -Be 2
            $payload.json.actions | Should -Be 'watchdog_repair'
            $payload.json.version | Should -Be '4.1.0'
        }

        It "Returns false when apiUrl is missing in config" {
            Mock Get-OpenPathConfig {
                [PSCustomObject]@{
                    version = '4.1.0'
                }
            } -ModuleName Common

            Mock Invoke-RestMethod {
                throw 'Invoke-RestMethod should not be called when apiUrl is missing'
            } -ModuleName Common

            $result = Send-OpenPathHealthReport -Status 'HEALTHY'
            $result | Should -BeFalse
        }
    }

    Context "Restore-OpenPathLatestCheckpoint" {
        It "Restores checkpoint whitelist and reapplies DNS controls" {
            $tempDir = Join-Path $env:TEMP ("openpath-checkpoint-" + [Guid]::NewGuid().ToString())
            $checkpointDir = Join-Path $tempDir 'checkpoint-001'
            $checkpointWhitelistPath = Join-Path $checkpointDir 'whitelist.txt'
            $targetWhitelistPath = Join-Path $tempDir 'whitelist.txt'

            try {
                New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
                @('google.com', 'example.org') | Set-Content $checkpointWhitelistPath -Encoding UTF8

                Mock Get-OpenPathLatestCheckpoint {
                    [PSCustomObject]@{
                        Path = $checkpointDir
                        WhitelistPath = $checkpointWhitelistPath
                        Metadata = $null
                    }
                } -ModuleName Common

                Mock Update-AcrylicHost { $true }
                Mock Restart-AcrylicService { $true }
                Mock Get-AcrylicPath { 'C:\OpenPath\Acrylic DNS Proxy' }
                Mock Set-OpenPathFirewall { $true }
                Mock Set-LocalDNS { }

                $config = [PSCustomObject]@{
                    enableFirewall = $true
                    primaryDNS = '8.8.8.8'
                }

                $result = Restore-OpenPathLatestCheckpoint -Config $config -WhitelistPath $targetWhitelistPath

                $result.Success | Should -BeTrue
                $result.DomainCount | Should -Be 2
                $result.CheckpointPath | Should -Be $checkpointDir

                $restoredContent = Get-Content $targetWhitelistPath -Raw
                $restoredContent.Contains('google.com') | Should -BeTrue
                $restoredContent.Contains('example.org') | Should -BeTrue
            }
            finally {
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Returns failure when checkpoint whitelist has no valid domains" {
            $tempDir = Join-Path $env:TEMP ("openpath-checkpoint-invalid-" + [Guid]::NewGuid().ToString())
            $checkpointDir = Join-Path $tempDir 'checkpoint-001'
            $checkpointWhitelistPath = Join-Path $checkpointDir 'whitelist.txt'
            $targetWhitelistPath = Join-Path $tempDir 'whitelist.txt'

            try {
                New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
                @('not-a-domain', '# comment') | Set-Content $checkpointWhitelistPath -Encoding UTF8

                Mock Get-OpenPathLatestCheckpoint {
                    [PSCustomObject]@{
                        Path = $checkpointDir
                        WhitelistPath = $checkpointWhitelistPath
                        Metadata = $null
                    }
                } -ModuleName Common

                $config = [PSCustomObject]@{
                    enableFirewall = $false
                    primaryDNS = '8.8.8.8'
                }

                $result = Restore-OpenPathLatestCheckpoint -Config $config -WhitelistPath $targetWhitelistPath

                $result.Success | Should -BeFalse
                $result.Error | Should -BeLike '*no valid domains*'
            }
            finally {
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}


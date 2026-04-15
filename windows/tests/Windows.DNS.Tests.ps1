# OpenPath Windows DNS suite aggregator.
# Keeps a stable entrypoint for Windows.Tests.ps1 and repo contracts while
# moving DNS modeling/install assertions into smaller suites.

Import-Module (Join-Path $PSScriptRoot "TestHelpers.psm1") -Force

$dnsSuites = @(
    'Windows.DNS.Core.Tests.ps1',
    'Windows.DNS.Install.Tests.ps1'
)

foreach ($suiteFile in $dnsSuites) {
    . (Join-Path $PSScriptRoot $suiteFile)
}

# OpenPath Windows common-module suite aggregator.
# Keeps a stable entrypoint for Windows.Tests.ps1 and repo contracts while
# allowing the individual domains to live in smaller suites.

Import-Module (Join-Path $PSScriptRoot "TestHelpers.psm1") -Force

$commonSuites = @(
    'Windows.Common.Core.Tests.ps1',
    'Windows.Common.Platform.Tests.ps1',
    'Windows.Common.Mocked.Tests.ps1'
)

foreach ($suiteFile in $commonSuites) {
    . (Join-Path $PSScriptRoot $suiteFile)
}

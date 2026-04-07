# OpenPath Firefox policy helpers for Windows

$script:OpenPathRoot = "C:\OpenPath"
Import-Module "$PSScriptRoot\Common.psm1" -Force -ErrorAction SilentlyContinue

function Get-OpenPathFirefoxExtensionRoot {
    return "$script:OpenPathRoot\browser-extension\firefox"
}

function Get-OpenPathFirefoxReleaseMetadataPath {
    return "$script:OpenPathRoot\browser-extension\firefox-release\metadata.json"
}

function Get-OpenPathFirefoxReleaseXpiPath {
    return "$script:OpenPathRoot\browser-extension\firefox-release\openpath-firefox-extension.xpi"
}

function ConvertTo-OpenPathFileUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $absolutePath = ''
    if ($Path -match '^[A-Za-z]:[\\/]') {
        $absolutePath = $Path
    }
    else {
        $resolvedPath = Resolve-Path $Path -ErrorAction SilentlyContinue
        $providerPath = if ($resolvedPath) { $resolvedPath.ProviderPath } else { $Path }
        $absolutePath = [System.IO.Path]::GetFullPath($providerPath)
    }

    if ($absolutePath.StartsWith('\')) {
        $uncParts = $absolutePath.TrimStart('\') -split '\\', 2
        $uriBuilder = [System.UriBuilder]::new()
        $uriBuilder.Scheme = [System.Uri]::UriSchemeFile
        $uriBuilder.Host = $uncParts[0]
        $uriBuilder.Path = if ($uncParts.Length -gt 1) { $uncParts[1] -replace '\\', '/' } else { '' }
        return $uriBuilder.Uri.AbsoluteUri
    }

    $uriBuilder = [System.UriBuilder]::new()
    $uriBuilder.Scheme = [System.Uri]::UriSchemeFile
    $uriBuilder.Host = ''
    $uriBuilder.Path = $absolutePath -replace '\\', '/'
    return $uriBuilder.Uri.AbsoluteUri
}

function Write-OpenPathUtf8NoBomFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [AllowNull()]
        [string]$Value
    )

    $parent = Split-Path $Path -Parent
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Value, $utf8NoBom)
}

function Get-OpenPathConfigTrimmedValue {
    param(
        [AllowNull()]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName
    )

    if (
        $Config -and
        $Config.PSObject.Properties[$PropertyName] -and
        $Config.PSObject.Properties[$PropertyName].Value
    ) {
        return ([string]$Config.PSObject.Properties[$PropertyName].Value).Trim()
    }

    return ''
}

function Get-OpenPathConfiguredFirefoxManagedExtensionPolicy {
    param(
        [AllowNull()]
        [object]$Config
    )

    $configuredExtensionId = Get-OpenPathConfigTrimmedValue -Config $Config -PropertyName 'firefoxExtensionId'
    $configuredInstallUrl = Get-OpenPathConfigTrimmedValue -Config $Config -PropertyName 'firefoxExtensionInstallUrl'

    if ($configuredExtensionId -and $configuredInstallUrl) {
        return [PSCustomObject]@{
            ExtensionId = $configuredExtensionId
            InstallUrl = $configuredInstallUrl
            Source = 'configured-install-url'
        }
    }

    if ($configuredExtensionId -or $configuredInstallUrl) {
        Write-OpenPathLog 'Firefox signed extension config is incomplete; both firefoxExtensionId and firefoxExtensionInstallUrl are required' -Level WARN
    }

    return $null
}

function Get-OpenPathFirefoxReleaseMetadata {
    $metadataPath = Get-OpenPathFirefoxReleaseMetadataPath
    if (-not (Test-Path $metadataPath)) {
        return $null
    }

    try {
        return Get-Content $metadataPath -Raw | ConvertFrom-Json
    }
    catch {
        Write-OpenPathLog "Failed to parse Firefox release extension metadata: $_" -Level WARN
        return $null
    }
}

function Get-OpenPathFirefoxReleaseExtensionId {
    param(
        [AllowNull()]
        [object]$Metadata
    )

    if ($Metadata -and $Metadata.PSObject.Properties['extensionId'] -and $Metadata.extensionId) {
        return ([string]$Metadata.extensionId).Trim()
    }

    return ''
}

function Resolve-OpenPathFirefoxReleaseInstallSpec {
    param(
        [AllowNull()]
        [object]$Config,

        [AllowNull()]
        [object]$Metadata
    )

    $apiBaseUrl = Get-OpenPathConfigTrimmedValue -Config $Config -PropertyName 'apiUrl'
    if ($apiBaseUrl) {
        $apiBaseUrl = $apiBaseUrl.TrimEnd('/')
    }

    $signedXpiPath = Get-OpenPathFirefoxReleaseXpiPath
    if ($apiBaseUrl -and (Test-Path $signedXpiPath)) {
        return [PSCustomObject]@{
            InstallUrl = "$apiBaseUrl/api/extensions/firefox/openpath.xpi"
            Source = 'managed-api'
        }
    }

    if (Test-Path $signedXpiPath) {
        return [PSCustomObject]@{
            InstallUrl = (ConvertTo-OpenPathFileUrl -Path $signedXpiPath)
            Source = 'staged-release'
        }
    }

    if ($Metadata -and $Metadata.PSObject.Properties['installUrl'] -and $Metadata.installUrl) {
        return [PSCustomObject]@{
            InstallUrl = ([string]$Metadata.installUrl).Trim()
            Source = 'metadata-install-url'
        }
    }

    return $null
}

function Get-OpenPathFirefoxManagedExtensionPolicy {
    $config = $null
    try {
        $config = Get-OpenPathConfig
    }
    catch {
        # Allow policy generation to proceed without a persisted config.
    }

    $configuredPolicy = Get-OpenPathConfiguredFirefoxManagedExtensionPolicy -Config $config
    if ($configuredPolicy) {
        return $configuredPolicy
    }

    $metadata = Get-OpenPathFirefoxReleaseMetadata
    if (-not $metadata) {
        return $null
    }

    $extensionId = Get-OpenPathFirefoxReleaseExtensionId -Metadata $metadata
    if (-not $extensionId) {
        Write-OpenPathLog 'Firefox release extension metadata is incomplete' -Level WARN
        return $null
    }

    $installSpec = Resolve-OpenPathFirefoxReleaseInstallSpec -Config $config -Metadata $metadata
    if (-not $installSpec) {
        Write-OpenPathLog 'Firefox release extension metadata did not resolve to a signed XPI source' -Level WARN
        return $null
    }

    return [PSCustomObject]@{
        ExtensionId = $extensionId
        InstallUrl = $installSpec.InstallUrl
        Source = $installSpec.Source
    }
}

function Set-FirefoxPolicy {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string[]]$BlockedPaths = @()
    )

    if (-not $PSCmdlet.ShouldProcess("Firefox", "Configure browser policies")) {
        return $false
    }

    Write-OpenPathLog "Configuring Firefox policies..."

    $firefoxPaths = @(
        "$env:ProgramFiles\Mozilla Firefox\distribution",
        "${env:ProgramFiles(x86)}\Mozilla Firefox\distribution"
    )

    $policiesSet = $false
    $unsignedExtensionManifest = Join-Path (Get-OpenPathFirefoxExtensionRoot) 'manifest.json'
    $managedExtensionPolicy = Get-OpenPathFirefoxManagedExtensionPolicy
    $signedExtensionWarningWritten = $false

    foreach ($firefoxPath in $firefoxPaths) {
        $firefoxExe = Split-Path $firefoxPath -Parent
        if (-not (Test-Path "$firefoxExe\firefox.exe")) {
            continue
        }

        if (-not (Test-Path $firefoxPath)) {
            New-Item -ItemType Directory -Path $firefoxPath -Force | Out-Null
        }

        $blockedUrls = @()
        foreach ($path in $BlockedPaths) {
            if ($path) {
                if ($path -notmatch "^\*://") {
                    $blockedUrls += "*://*$path*"
                }
                else {
                    $blockedUrls += $path
                }
            }
        }

        $blockedUrls += @(
            "*://www.google.com/search*",
            "*://www.google.es/search*",
            "*://google.com/search*",
            "*://google.es/search*"
        )

        $policies = @{
            policies = @{
                SearchEngines = @{
                    Remove = @("Google", "Bing")
                    Default = "DuckDuckGo"
                    Add = @(
                        @{
                            Name = "DuckDuckGo"
                            Description = "Privacy-focused search engine"
                            Alias = "ddg"
                            Method = "GET"
                            URLTemplate = "https://duckduckgo.com/?q={searchTerms}"
                            IconURL = "https://duckduckgo.com/favicon.ico"
                        },
                        @{
                            Name = "Wikipedia (ES)"
                            Description = "Free encyclopedia"
                            Alias = "wiki"
                            Method = "GET"
                            URLTemplate = "https://es.wikipedia.org/wiki/Special:Search?search={searchTerms}"
                        }
                    )
                }
                WebsiteFilter = @{
                    Block = $blockedUrls
                }
                DNSOverHTTPS = @{
                    Enabled = $false
                    Locked = $true
                }
                DisableTelemetry = $true
                OverrideFirstRunPage = ""
            }
        }

        if ($managedExtensionPolicy) {
            $policies.policies.ExtensionSettings = @{
                $managedExtensionPolicy.ExtensionId = @{
                    installation_mode = 'force_installed'
                    install_url = $managedExtensionPolicy.InstallUrl
                }
            }
        }
        elseif (-not $signedExtensionWarningWritten) {
            if (Test-Path $unsignedExtensionManifest) {
                Write-OpenPathLog 'Unsigned Firefox extension bundle detected, but Firefox Release requires a signed XPI distribution; skipping extension auto-install' -Level WARN
            }
            else {
                Write-OpenPathLog 'No signed Firefox extension distribution configured; applying Firefox policies without extension auto-install' -Level WARN
            }

            $signedExtensionWarningWritten = $true
        }

        $policiesPath = "$firefoxPath\policies.json"
        $policiesJson = $policies | ConvertTo-Json -Depth 10
        Write-OpenPathUtf8NoBomFile -Path $policiesPath -Value $policiesJson

        Write-OpenPathLog "Firefox policies written to: $policiesPath"
        $policiesSet = $true
    }

    if (-not $policiesSet) {
        Write-OpenPathLog "Firefox not found, skipping policies" -Level WARN
    }

    return $policiesSet
}

Export-ModuleMember -Function @(
    'Get-OpenPathFirefoxExtensionRoot',
    'Get-OpenPathFirefoxReleaseMetadataPath',
    'Get-OpenPathFirefoxReleaseXpiPath',
    'Get-OpenPathConfigTrimmedValue',
    'Get-OpenPathFirefoxManagedExtensionPolicy',
    'Set-FirefoxPolicy'
)

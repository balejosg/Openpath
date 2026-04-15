function Get-LegacyRotationAuthToken {
    param(
        [Parameter(Mandatory = $true)][string]$SecretOverride
    )

    if ($SecretOverride) {
        return $SecretOverride
    }

    return ''
}

function Resolve-OpenPathRotationAuth {
    param(
        [Parameter(Mandatory = $true)][psobject]$Config,
        [Parameter(Mandatory = $true)][string]$SecretOverride
    )

    $machineToken = ''
    if ($Config.PSObject.Properties['whitelistUrl'] -and $Config.whitelistUrl) {
        $machineToken = Get-OpenPathMachineTokenFromWhitelistUrl -WhitelistUrl ([string]$Config.whitelistUrl)
    }

    if ($machineToken) {
        return [pscustomobject]@{
            Token = $machineToken
            Source = 'machine token'
        }
    }

    $legacyToken = Get-LegacyRotationAuthToken -SecretOverride $SecretOverride
    if ($legacyToken) {
        return [pscustomobject]@{
            Token = $legacyToken
            Source = 'legacy shared secret'
        }
    }

    return [pscustomobject]@{
        Token = ''
        Source = ''
    }
}

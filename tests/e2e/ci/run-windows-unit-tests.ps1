[CmdletBinding()]
param(
    [switch]$Child,
    [string]$RepoRoot = (Join-Path $PSScriptRoot '..' '..' '..'),
    [string]$ResultsPath = 'windows-test-results.xml',
    [string]$TestPath = '',
    [int]$TimeoutSeconds = 900
)

$ErrorActionPreference = 'Stop'

function Resolve-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [string]$BasePath = (Get-Location).Path
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Initialize-JobObjectInterop {
    if ('OpenPath.WindowsJobObject' -as [type]) {
        return
    }

    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace OpenPath {
    public static class WindowsJobObject {
        public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

        public enum JOBOBJECTINFOCLASS : int {
            JobObjectExtendedLimitInformation = 9
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public IntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct IO_COUNTERS {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetInformationJobObject(
            IntPtr hJob,
            JOBOBJECTINFOCLASS jobObjectInfoClass,
            IntPtr lpJobObjectInfo,
            uint cbJobObjectInfoLength
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseHandle(IntPtr hObject);
    }
}
'@
}

function New-KillOnCloseJobObject {
    Initialize-JobObjectInterop

    $jobHandle = [OpenPath.WindowsJobObject]::CreateJobObject([IntPtr]::Zero, $null)
    if ($jobHandle -eq [IntPtr]::Zero) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Failed to create Windows job object. Win32Error=$errorCode"
    }

    $limitInfo = New-Object OpenPath.WindowsJobObject+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    $limitInfo.BasicLimitInformation.LimitFlags = [OpenPath.WindowsJobObject]::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

    $structSize = [System.Runtime.InteropServices.Marshal]::SizeOf($limitInfo)
    $buffer = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($structSize)
    try {
        [System.Runtime.InteropServices.Marshal]::StructureToPtr($limitInfo, $buffer, $false)
        $configured = [OpenPath.WindowsJobObject]::SetInformationJobObject(
            $jobHandle,
            [OpenPath.WindowsJobObject+JOBOBJECTINFOCLASS]::JobObjectExtendedLimitInformation,
            $buffer,
            [uint32]$structSize
        )

        if (-not $configured) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to configure Windows job object. Win32Error=$errorCode"
        }
    }
    catch {
        [void][OpenPath.WindowsJobObject]::CloseHandle($jobHandle)
        throw
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    }

    return $jobHandle
}

function Close-JobObjectHandle {
    param(
        [Parameter(Mandatory = $true)]
        [System.IntPtr]$Handle
    )

    if ($Handle -eq [System.IntPtr]::Zero) {
        return
    }

    [void][OpenPath.WindowsJobObject]::CloseHandle($Handle)
}

function Invoke-IsolatedPwshProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,

        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [string]$ResultsPath,

        [string]$TestPath,

        [Parameter(Mandatory = $true)]
        [int]$TimeoutSeconds
    )

    $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
    $jobHandle = [System.IntPtr]::Zero
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $pwshPath
    $startInfo.WorkingDirectory = $RepoRoot
    $startInfo.UseShellExecute = $false
    # Let the isolated child inherit the runner console directly.
    # Redirected pipes can stay open after pwsh exits if descendants inherit
    # the handles, which leaves the CI wrapper blocked on EOF.
    $startInfo.RedirectStandardOutput = $false
    $startInfo.RedirectStandardError = $false

    foreach ($argument in @(
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            $ScriptPath,
            '-Child',
            '-RepoRoot',
            $RepoRoot,
            '-ResultsPath',
            $ResultsPath,
            '-TestPath',
            $TestPath,
            '-TimeoutSeconds',
            [string]$TimeoutSeconds
        )) {
        [void]$startInfo.ArgumentList.Add($argument)
    }

    $startInfo.Environment['OPENPATH_WINDOWS_CI_ISOLATED_PESTER'] = '1'

    $jobHandle = New-KillOnCloseJobObject
    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw 'Failed to start isolated pwsh process for Windows unit tests.'
    }

    try {
        $assignedToJob = [OpenPath.WindowsJobObject]::AssignProcessToJobObject($jobHandle, $process.Handle)
        if (-not $assignedToJob) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to assign isolated Windows Pester host to the kill-on-close job object. Win32Error=$errorCode"
        }

        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try {
                $process.Kill($true)
            }
            catch {
                # Best effort.
            }

            throw "Isolated Windows Pester host timed out after $TimeoutSeconds seconds."
        }

        if ($process.ExitCode -ne 0) {
            throw "Isolated Windows Pester host failed with exit code $($process.ExitCode)."
        }
    }
    finally {
        try {
            if (-not $process.HasExited) {
                try {
                    $process.Kill($true)
                    $null = $process.WaitForExit(5000)
                }
                catch {
                    # Best effort.
                }
            }
        }
        finally {
            try {
                Close-JobObjectHandle -Handle $jobHandle
            }
            finally {
                $process.Dispose()
            }
        }
    }
}

function Invoke-ChildPesterRun {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [string]$ResultsPath,

        [string]$TestPath
    )

    Set-Location $RepoRoot

    if (Test-Path $ResultsPath) {
        Remove-Item $ResultsPath -Force
    }

    $minimumPesterVersion = [version]'5.0.0'
    $availablePester = Get-Module -ListAvailable -Name Pester |
        Sort-Object Version -Descending |
        Select-Object -First 1

    if ($null -eq $availablePester -or $availablePester.Version -lt $minimumPesterVersion) {
        Install-Module -Name Pester -MinimumVersion $minimumPesterVersion.ToString() -Force -Scope CurrentUser
    }

    Import-Module Pester -MinimumVersion $minimumPesterVersion -ErrorAction Stop

    # Match the historical workflow host semantics for the Windows suite.
    # Several legacy assertions rely on Pester's default non-strict runtime.
    Set-StrictMode -Off

    $config = New-PesterConfiguration
    $config.Run.Path = if ([string]::IsNullOrWhiteSpace($TestPath)) {
        'windows/tests'
    }
    else {
        $TestPath
    }
    $config.Run.PassThru = $true
    $config.Output.Verbosity = 'Detailed'
    $config.TestResult.Enabled = $true
    $config.TestResult.OutputPath = $ResultsPath
    $config.TestResult.OutputFormat = 'NUnitXml'

    $result = Invoke-Pester -Configuration $config

    if (-not (Test-Path $ResultsPath)) {
        throw "Windows Pester suite did not produce $ResultsPath."
    }

    if ($null -eq $result) {
        throw 'Invoke-Pester returned no result object.'
    }

    if ($result.FailedCount -gt 0) {
        throw "Windows Pester suite reported $($result.FailedCount) failure(s)."
    }

    $jobs = @(Get-Job -ErrorAction SilentlyContinue)
    if ($jobs.Count -gt 0) {
        $jobs | Stop-Job -ErrorAction SilentlyContinue
        $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    }
}

function Get-PerTestResultsPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResultsPath,

        [Parameter(Mandatory = $true)]
        [string]$TestPath,

        [Parameter(Mandatory = $true)]
        [int]$TestCount
    )

    if ($TestCount -le 1) {
        return $ResultsPath
    }

    $resultsDirectory = Split-Path $ResultsPath -Parent
    $resultsBaseName = [System.IO.Path]::GetFileNameWithoutExtension($ResultsPath)
    $resultsExtension = [System.IO.Path]::GetExtension($ResultsPath)
    $testBaseName = [System.IO.Path]::GetFileNameWithoutExtension($TestPath)

    return Join-Path $resultsDirectory ("{0}.{1}{2}" -f $resultsBaseName, $testBaseName, $resultsExtension)
}

$RepoRoot = Resolve-FullPath -Path $RepoRoot
$ResultsPath = Resolve-FullPath -Path $ResultsPath -BasePath $RepoRoot
$resultsDirectory = Split-Path $ResultsPath -Parent

if ($resultsDirectory -and -not (Test-Path $resultsDirectory)) {
    New-Item -ItemType Directory -Path $resultsDirectory -Force | Out-Null
}

if ($Child) {
    Invoke-ChildPesterRun -RepoRoot $RepoRoot -ResultsPath $ResultsPath -TestPath $TestPath
    return
}

$testFiles = @(
    Get-ChildItem -Path (Join-Path $RepoRoot 'windows/tests') -Filter '*.Tests.ps1' -File |
        Sort-Object Name |
        Select-Object -ExpandProperty FullName
)

if ($testFiles.Count -eq 0) {
    throw "No Windows Pester test files were found beneath $(Join-Path $RepoRoot 'windows/tests')."
}

$lastResultsPath = ''

foreach ($testFile in $testFiles) {
    $perTestResultsPath = Get-PerTestResultsPath -ResultsPath $ResultsPath -TestPath $testFile -TestCount $testFiles.Count
    Write-Host ("Running isolated Windows Pester file: {0}" -f [System.IO.Path]::GetFileName($testFile))

    Invoke-IsolatedPwshProcess `
        -ScriptPath $MyInvocation.MyCommand.Path `
        -RepoRoot $RepoRoot `
        -ResultsPath $perTestResultsPath `
        -TestPath $testFile `
        -TimeoutSeconds $TimeoutSeconds

    $lastResultsPath = $perTestResultsPath
}

if (-not [string]::IsNullOrWhiteSpace($lastResultsPath) -and $lastResultsPath -ne $ResultsPath) {
    Copy-Item -Path $lastResultsPath -Destination $ResultsPath -Force
}

if (-not (Test-Path $ResultsPath)) {
    throw "Windows Pester suite did not produce $ResultsPath."
}

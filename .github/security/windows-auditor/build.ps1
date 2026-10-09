[CmdletBinding()]
param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $projectDirectory 'SiteSecurityAuditor.cs'
$manifestPath = Join-Path $projectDirectory 'app.manifest'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $env:LOCALAPPDATA 'SiteSecurityAuditor'
}
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory '..\..\..')).TrimEnd('\')
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
if ($resolvedOutput.Equals($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $resolvedOutput.StartsWith($repositoryRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputDirectory must be outside the repository because the Netlify configuration publishes the repository root.'
}
$OutputDirectory = $resolvedOutput
$compilerCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$compilerPath = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $compilerPath) {
    throw 'The .NET Framework C# compiler was not found. Enable .NET Framework 4.x developer tools and retry.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$appPath = Join-Path $OutputDirectory 'SiteSecurityAuditor.exe'
$testPath = Join-Path $OutputDirectory 'SiteSecurityAuditor.Tests.exe'
$references = @(
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Drawing.dll',
    '/r:System.Net.Http.dll',
    '/r:System.Web.Extensions.dll',
    '/r:System.Windows.Forms.dll'
)

& $compilerPath /nologo /optimize+ /platform:anycpu /target:winexe "/win32manifest:$manifestPath" "/out:$appPath" @references $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'Windows application compilation failed.' }

& $compilerPath /nologo /optimize+ /platform:anycpu /target:exe /define:TEST "/out:$testPath" @references $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'Self-test compilation failed.' }

& $testPath
if ($LASTEXITCODE -ne 0) { throw 'Self-tests failed.' }

$hash = (Get-FileHash -LiteralPath $appPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Built $appPath"
Write-Host "SHA256 $hash"

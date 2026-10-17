$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$project = Join-Path $PSScriptRoot 'BtBridge.csproj'
$artifacts = Join-Path $repo 'build/windows-bt-artifacts'
$output = Join-Path $repo 'build/windows-bt-bridge'
dotnet publish $project -c Release --artifacts-path $artifacts -o $output --nologo --verbosity quiet
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output (Join-Path $output 'bt-bridge.exe')

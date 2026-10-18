param(
    [string]$BindAddress,
    [string]$StateDir,
    [string]$Token,
    [switch]$NoAuth,
    [switch]$RequireAuth,
    [switch]$NoBuild
)
$ErrorActionPreference = 'Stop'
if ($NoAuth -and $RequireAuth) { throw 'Use either -NoAuth or -RequireAuth, not both.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $StateDir) { $StateDir = Join-Path $repo 'state/windows-wireless' }
$StateDir = [IO.Path]::GetFullPath($StateDir)
$configPath = Join-Path $StateDir 'config.json'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Create $configPath from windows/config.example.json and enter the phone's Wi-Fi details."
}
try { $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json }
catch { throw "Invalid JSON in $configPath" }
if (-not $config.wireless -or [string]::IsNullOrWhiteSpace($config.wifiSsid) -or
    [string]::IsNullOrEmpty($config.wifiPassphrase)) {
    throw 'Set wireless=true, wifiSsid and wifiPassphrase in the local config. Use a WPA2 or WPA2/WPA3 mixed network.'
}
if (-not $BindAddress) {
    $candidates = @(Get-NetIPConfiguration | Where-Object {
        $_.NetAdapter.Status -eq 'Up' -and $_.NetAdapter.HardwareInterface -and $_.IPv4DefaultGateway
    } | ForEach-Object { $_.IPv4Address.IPAddress } | Select-Object -Unique)
    if ($candidates.Count -ne 1) {
        throw 'LAN address is ambiguous; pass -BindAddress with the IPv4 address reachable from the iPhone.'
    }
    $BindAddress = $candidates[0]
}

function Test-PortAvailable([string]$Address, [int]$Port) {
    $listener = $null
    try {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse($Address), $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

Push-Location $repo
$runLock = $null
try {
    try {
        $runLock = [IO.File]::Open((Join-Path $StateDir 'server.lock'),
            [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch { throw 'Another PlayPort launcher is already using this state directory.' }
    $webPort = if ($config.httpPort) { [int]$config.httpPort } else { 8080 }
    $airPlayPort = if ($config.airPlayPort) { [int]$config.airPlayPort } else { 7000 }
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $webPort,$airPlayPort -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @($BindAddress, '0.0.0.0', '::') })
    if ($listeners.Count -gt 0) { throw 'A server already uses a configured port. Stop it before starting PlayPort.' }
    if (-not (Test-PortAvailable $BindAddress $webPort)) {
        throw "Browser port $webPort cannot bind on $BindAddress. Check Windows port reservations or another service."
    }
    $airPlayPortOverride = $false
    if (-not (Test-PortAvailable $BindAddress $airPlayPort)) {
        # Hyper-V and other Windows components can reserve a port range without a
        # listening process. Keep 7000 as the normal/default port, but use an mDNS
        # advertised fallback when the OS has reserved it. An actually listening
        # service was rejected above instead of being silently bypassed.
        $fallbackPorts = 7100, 7300, 7400, 7500, 7600, 7700
        $fallback = $fallbackPorts | Where-Object { Test-PortAvailable $BindAddress $_ } | Select-Object -First 1
        if ($null -eq $fallback) {
            throw "AirPlay port $airPlayPort cannot bind and no fallback port is available. Check Windows port reservations."
        }
        Write-Warning "AirPlay port $airPlayPort is reserved or unavailable on $BindAddress; using fallback port $fallback."
        $airPlayPort = [int]$fallback
        $airPlayPortOverride = $true
    }
    if (-not $NoBuild) {
        & .\gradlew.bat --console=plain :server:installDist
        if ($LASTEXITCODE -ne 0) { throw 'Server build failed' }
        & .\windows\bt-bridge\build.ps1
        if ($LASTEXITCODE -ne 0) { throw 'Bluetooth bridge build failed' }
        Push-Location web
        try {
            if (-not (Test-Path node_modules)) {
                & npm.cmd ci --ignore-scripts
                if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed' }
            }
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
        } finally { Pop-Location }
    }
    $bridge = Join-Path $repo 'build/windows-bt-bridge/bt-bridge.exe'
    $libraries = Join-Path $repo 'server/build/install/server/lib/*'
    if (-not (Test-Path $bridge) -or -not (Test-Path 'server/build/install/server/lib') -or
        -not (Test-Path 'web/dist/index.html')) { throw 'Build outputs are missing; run without -NoBuild.' }
    # JVMs load classes lazily. Overwriting a running JAR during installDist can leave
    # cached ZIP offsets pointing at the new file and break input/audio classes later.
    # Give each process its own JAR/helper snapshot, independent of subsequent builds.
    $runtime = Join-Path $repo ('build/windows-runtime/' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'server/build/install/server/lib') -Destination (Join-Path $runtime 'lib') -Recurse
    Copy-Item -LiteralPath (Join-Path $repo 'build/windows-bt-bridge') -Destination (Join-Path $runtime 'bt-bridge') -Recurse
    $libraries = Join-Path $runtime 'lib/*'
    $bridge = Join-Path $runtime 'bt-bridge/bt-bridge.exe'
    Write-Output "Starting PlayPort on $BindAddress with local config $configPath"
    Write-Output "Runtime snapshot: $runtime"
    # Credentials stay in the config file, not command-line arguments or shell history.
    $serverArgs = @('--state-dir', $StateDir, '--bind', $BindAddress, '--bt-bridge', $bridge, '--mdns', 'jmdns')
    if ($airPlayPortOverride) { $serverArgs += @('--airplay-port', $airPlayPort) }
    if ($Token) { $serverArgs += @('--token', $Token) }
    if ($NoAuth) { $serverArgs += '--no-auth' }
    if ($RequireAuth) { $serverArgs += '--require-auth' }
    & java '-Dfile.encoding=UTF-8' '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' `
        -cp $libraries com.playport.server.MainKt @serverArgs
    exit $LASTEXITCODE
} finally {
    if ($runLock) { $runLock.Dispose() }
    Pop-Location
}

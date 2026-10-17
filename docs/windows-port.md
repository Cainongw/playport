# Windows wireless CarPlay

[English README](../README.md) · [简体中文](../README.zh-CN.md)

The Windows port reuses PlayPort's Kotlin protocol/server and browser client. A
small .NET helper supplies the Bluetooth RFCOMM connection through Windows APIs.
The iPhone uses Wi-Fi for media; the receiving computer can use Ethernet on the
same reachable LAN. Windows Wi-Fi Direct, a hotspot and Apple USB drivers are not
required for this path.

## Requirements and setup

- Windows 11 x64 is the validated platform, with a working Bluetooth adapter.
- JDK 25 for the pinned Gradle daemon; compiled modules target JVM 21.
- .NET 10 SDK for the Bluetooth helper.
- Node.js 22.12+ and npm for the browser build.
- A CarPlay-capable iPhone, paired in Windows Bluetooth settings.
- A WPA2-Personal or WPA2/WPA3 mixed Wi-Fi network reachable from the receiver.
- The separately supplied MFi identity described in the [README](../README.md#accessory-identity-required).

From PowerShell at the repository root:

```powershell
New-Item -ItemType Directory -Path state/windows-wireless -Force
Copy-Item windows/config.example.json state/windows-wireless/config.json
notepad state/windows-wireless/config.json
```

Fill `wifiSsid` and `wifiPassphrase` with the iPhone's Wi-Fi details, then save.
Keep credentials in this ignored local file, not in the tracked example.
Do not overwrite an existing local config when updating the project.

Pair through **Windows Settings → Bluetooth & devices → Add device**, keeping
**Settings → Bluetooth** open on the iPhone. Confirm the pairing code on both
devices. Automatic selection looks for a paired device with `iPhone` in its name.
For renamed or multiple phones, set `bluetoothDeviceAddress` in the local config:

```json
"bluetoothDeviceAddress": "AA:BB:CC:DD:EE:FF"
```

This is a field inside the existing JSON object. After building the helper,
`build/windows-bt-bridge/bt-bridge.exe --list` lists paired devices and addresses.

## Start and stop

```powershell
# Build the server, Bluetooth bridge and web client, then run.
.\windows\run.ps1

# Reuse the existing build on subsequent starts.
.\windows\run.ps1 -NoBuild
```

Open the printed HTTPS viewer URL in Chrome or Edge, accept the local self-signed
certificate, and accept the CarPlay prompt on the iPhone. If asked for a CarPlay
PIN, use **3939**. Click/tap the browser page to enable sound. Stop the server with
Ctrl+C before starting another instance.

| Launcher option | Purpose |
| --- | --- |
| `-BindAddress <IPv4>` | Select the receiver's LAN address when automatic selection is ambiguous |
| `-StateDir <path>` | Use a different directory containing `config.json` |
| `-Token <value>` | Use a fixed browser access token |
| `-NoAuth` | Override saved settings to allow viewing/control without a token |
| `-RequireAuth` | Override saved settings to require a token |
| `-NoBuild` | Reuse already built server, bridge and web assets |

Automatic selection requires one active physical IPv4 interface with a gateway,
excluding virtual adapters. If several qualify, provide `-BindAddress` explicitly.
The launcher checks its state lock and configured TCP ports to prevent duplicate
instances. It does not change firewall rules or system Bluetooth/network settings.

The Windows launcher uses `state/windows-wireless/` by default. Direct JVM launches
use `~/.playport/` unless `--state-dir` is supplied. Display settings, Wi-Fi details,
pairing records and TLS material live in the selected state directory.

## Other screens and token settings

Other devices open the receiver's printed LAN URL; they do not pair with the iPhone
or run another server. Multiple viewers share one CarPlay session and resolution.
Each device needs a compatible HTTPS/WebCodecs browser and its own audio interaction.

Token protection is on by default. To allow a URL without `?token=...`, save
`"noAuth": true` in the local config and restart, or start with `-NoAuth`.
Anyone able to reach the viewer port can then view and control CarPlay, including
changing display settings. HTTPS and MFi authentication remain enabled.

Save `"noAuth": false` and restart, or use `-RequireAuth`, to restore protection.
CLI overrides take precedence and may be persisted when display settings are saved.

## Full screen

**Full screen**, beside **Focus mode**, enters native browser fullscreen, measures
the viewport in physical pixels, and requests even dimensions within the receiver's
480–3840 pixel limits. It preserves aspect ratio for normal screen proportions and
retains the selected frame rate, codec and CarPlay UI size. A changed resolution
reconnects the phone and affects every viewer; an unchanged size does not reconnect.

Headers, side tools and bottom menus disappear. Press Esc or move/touch to reveal
the corner exit button. Exiting restores the previous page/Focus layout and retains
the requested resolution. Unsupported or denied fullscreen requests leave the
layout and server settings unchanged.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| PowerShell blocks the script | Follow the execution policy permitted on your machine; no policy changes are made by the launcher |
| LAN address is ambiguous | Supply the physical adapter's IPv4 address with `-BindAddress` |
| No paired iPhone found | Pair through Windows settings, or set `bluetoothDeviceAddress` for a renamed phone |
| RFCOMM connection fails | Enable Bluetooth on both devices, unlock the phone, check the existing pairing, and retry |
| Phone does not start CarPlay | Check Wi-Fi credentials, LAN reachability and the iPhone's CarPlay prompt/settings |
| Another screen cannot reach the viewer | Use the printed receiver address; check TCP 8080 access, Windows firewall and router client isolation |
| Page loads but phone never reaches the receiver | Check AirPlay TCP 7000, mDNS discovery and media traffic; allow the Java receiver on the trusted LAN |
| Video is black | Use HTTPS, handle the certificate prompt, use H.264 and refresh with Ctrl+F5 |
| Browser is silent | Click/tap the page, check the Audio panel/system output, then play music in CarPlay |
| Port or state already in use | Stop the existing receiver before launching again |

The defaults are HTTPS TCP 8080 and AirPlay TCP 7000. AirPlay also negotiates media
ports, so allowing only those two TCP ports is not sufficient for all media traffic.

## Validation and limitations

On one Windows 11 x64 setup with an iPhone running iOS 27.2, hardware validation
covered Bluetooth/iAP2 setup, MFi authentication, AirPlay, H.264 video, touch input,
Apple Music playback, multiple LAN viewers, token-free access and fullscreen.

Music starts with a 600 ms jitter buffer to absorb observed wireless delivery bursts;
voice retains a 120 ms buffer. Touch release keeps its coordinates so buttons such
as Music's back arrow receive a valid release inside their bounds. Bonjour and
AirPlay advertise consistent capabilities, including the implemented microphone
input formats needed for the tested phone's audio routing.

Actual microphone capture, calls, HEVC and extended reconnect/stability testing
remain outstanding. Advertised frame rates are requests, not measured guarantees.
Wired USB is not implemented: a working iAP2/MFi byte stream alone does not provide
the required USB media network.

## Development

```powershell
.\gradlew.bat --console=plain build :server:installDist
.\windows\bt-bridge\build.ps1
Push-Location web
npm ci
npm run build
npm test
Pop-Location
```

The helper preserves the macOS bridge's CLI: `--print-address`, `--list` and
`--address <MAC>`. Connection mode uses binary stdin/stdout for iAP2 and stderr for
diagnostics. The JVM owns authentication, protocol handling and media processing.

Each launcher run copies the JARs/helper to an ignored `build/windows-runtime/`
snapshot. Rebuilding `installDist` cannot overwrite libraries that a running JVM
may still load. Remove old snapshots only after their server processes have stopped.
The web client continues to use `web/dist/`; refresh browsers after a frontend build.

JVM tests cover input reports, advertised audio formats and protected/open viewer
access. Browser regressions cover touch, keyboard isolation, audio scheduling,
access discovery and fullscreen resolution/lifecycle. The local MFi signature test
skips if the identity directory is absent; a green build alone does not prove that
an accessory identity is installed.

The Windows Gradle launcher comes from Gradle v9.5.0 and retains its Apache-2.0 notice.
The repository's Gradle distribution and checksum remain pinned.

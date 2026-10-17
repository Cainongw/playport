<div align="center">

<img src="docs/playport-logo.svg" alt="PlayPort" width="320" />

**Wireless CarPlay in your browser.**
A server-side CarPlay receiver that turns any screen on your network into a head unit.

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Platforms: Windows and macOS](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#requirements)
[![Status: experimental](https://img.shields.io/badge/status-experimental-orange.svg)](#status-and-limitations)

[English](README.md) · [简体中文](README.zh-CN.md)

</div>

![PlayPort live CarPlay viewer](docs/screenshots/dashboard.jpg)

PlayPort runs the **car** side of CarPlay on Windows or macOS. Your iPhone connects through
Bluetooth for setup, then streams video and audio over the LAN. Open the viewer in a compatible
browser to see and control CarPlay. The receiving computer can use Ethernet while the iPhone
uses Wi-Fi on the same reachable network; no dongle or iPhone app is needed.

This fork adds a Windows Bluetooth bridge and launcher, fixes touch release and music playback,
and adds optional token-free access and immersive fullscreen. Windows video, touch, music,
multiple viewers and fullscreen have been verified on one Windows 11 setup. Microphone input,
calls and long-running stability on Windows still need validation. **Wired USB is not supported.**

> **Port notice.** PlayPort's AirPlay, iAP2 and accessory-authentication code is ported from
> [DiPlay](https://github.com/shihabal3amri/DiPlay) by shihabal3amri, itself based on
> [xcertplay](https://github.com/shilapi/xcertplay) by shilapi (both GPL-3.0). PlayPort replaces the
> Android head-unit app with a JVM server and a WebCodecs browser client. It is an independent
> project, not affiliated with or endorsed by the DiPlay or xcertplay authors.

The original desktop/browser implementation is [youcci/PlayPort](https://github.com/youcci/playport).

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Screenshots](#screenshots)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Accessory identity (required)](#accessory-identity-required)
- [Display, orientation and quality](#display-orientation-and-quality)
- [Audio and microphone](#audio-and-microphone)
- [Controls](#controls)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Security and privacy](#security-and-privacy)
- [Project layout](#project-layout)
- [Development](#development)
- [Status and limitations](#status-and-limitations)
- [Credits and license](#credits-and-license)

---

## How it works

```
          Bluetooth (first pairing)                     Wi-Fi / LAN
   ┌──────────────────────────────────┐   ┌─────────────────────────────────────────┐
   │  iAP2 identification             │   │  mDNS advertisement (_airplay._tcp)     │
   │  MFi authentication              │   │  AirPlay RTSP: pairing, /info, SETUP    │
   │  Wi-Fi credentials handoff       │   │  H.264 / HEVC video  +  RTP audio       │
   └──────────────────────────────────┘   │  HID input  +  iAP2 control tunnel      │
                                          └─────────────────────────────────────────┘
                        │                                     │
                        ▼                                     ▼
              ┌──────────────────────────────────────────────────────────┐
              │  PlayPort server (Kotlin/JVM + Ktor)                     │
              │  · :protocol — ported DiPlay stack (AirPlay, iAP2, MFi)  │
              │  · RTSP listener, mDNS, pairing store, BT bridge         │
              │  · decrypts media, never re-encodes it                   │
              └──────────────────────────────────────────────────────────┘
                        │  WebSocket: binary media + JSON control
                        ▼
              ┌──────────────────────────────────────────────────────────┐
              │  Browser client (TypeScript, no framework)               │
              │  · WebCodecs VideoDecoder → canvas  ·  AudioDecoder      │
              │  · pointer + keyboard → CarPlay HID                      │
              └──────────────────────────────────────────────────────────┘
```

The iPhone thinks it is talking to a car head unit: PlayPort advertises itself over Bonjour,
authenticates with an MFi identity, receives the encrypted H.264/HEVC screen and RTP audio, and
sends touch/knob/media HID reports back. The server **passes the phone's encoded media straight to
the browser** (no server-side decoding or re-encoding), and the browser decodes it with WebCodecs.

## Features

- **Wireless CarPlay** — Bluetooth iAP2 bootstrap + Wi-Fi handoff, with a connection supervisor that
  re-invites the phone whenever the link drops.
- **Compatible browsers become screens** — laptops, tablets and other LAN devices can view the
  same session. HTTPS and WebCodecs support are required; Chrome/Edge are the initial target.
- **Responsive viewer** — grouped controls, dedicated display/audio panels, a connection guide,
  focus mode, and immersive fullscreen that hides all bars and requests the screen's resolution.
- **Touch and knob input** — up to two touch contacts, keyboard as rotary knob, toolbar buttons for
  Home/Back/Select, media transport and Siri.
- **Calls and Siri** — when the phone opens its speech/telephony stream, the browser asks for the
  microphone and streams audio back (PCM, or Opus when requested).
- **Display control** — live resolution, portrait/landscape, frame rate, CarPlay UI size and
  H.264/HEVC selection, with presets from 800×480 up to 4K.
- **Quality tuning** — "Match this window" advertises your display's physical pixels for 1:1
  sharpness; a stats HUD shows resolution, fps, bitrate, drops, decode queue and latency.
- **Audio mixer** — master plus per-stream volumes (media, navigation, Siri/calls).
- **Persistent settings** — display and connection settings stay in the server state directory;
  audio levels are saved in your browser.
- **Optional token-free access** — tokens protect viewing/control by default; a local setting can
  allow other screens to connect without a token.
- **No cloud, no account** — everything runs on your machine and your LAN.

## Screenshots

| Display and quality | Audio mixer (no active streams) |
|---|---|
| ![Display settings](docs/screenshots/display-panel.jpg) | ![Audio mixer](docs/screenshots/audio-controls.jpg) |
| **Focus mode** | **Mobile viewer** |
| ![Focus mode](docs/screenshots/focus-mode.jpg) | <img src="docs/screenshots/mobile.jpg" alt="Mobile viewer" width="250" /> |

## Requirements

| Component | Requirement |
|---|---|
| Server | Windows 11 x64 (validated), or macOS 13+ (upstream platform) |
| Java | JDK 25 for the pinned Gradle build daemon; generated JVM code targets Java 21 |
| Windows build tools | .NET 10 SDK for the native Windows Bluetooth bridge |
| macOS build tools | Xcode Command Line Tools (`xcode-select --install`) for the Swift bridge |
| Web build | Node.js 22.12+ and npm; the pinned Vite version also accepts Node.js 20.19+ |
| Viewer | HTTPS browser with WebCodecs video/audio decoding; start with Chrome or Edge and H.264 |
| iPhone | Any CarPlay-capable iPhone with Bluetooth and Wi-Fi |
| Network | Bluetooth enabled on receiver and iPhone; iPhone Wi-Fi and receiver on a reachable LAN |
| Accessory identity | Matching MFi certificate/key supplied separately; see [below](#accessory-identity-required) |

## Quick start

### Windows

Install the requirements above and pair the iPhone in **Windows Settings → Bluetooth & devices**.
Keep **Settings → Bluetooth** open on the iPhone while pairing and confirm the displayed code.
Then run from PowerShell:

```powershell
git clone git@github.com:Cainongw/playport.git
cd playport

# 1. Supply identity/offline-mfi/identity.pk8 and certificate.p7b (see below).

# 2. Create a local configuration; do not put Wi-Fi credentials in the tracked example.
# Skip this copy if a local config already exists.
New-Item -ItemType Directory -Path state/windows-wireless -Force
Copy-Item windows/config.example.json state/windows-wireless/config.json
notepad state/windows-wireless/config.json
# Fill wifiSsid and wifiPassphrase, save, then close the editor.

# 3. Build the JVM server, Bluetooth bridge and web client, then start.
.\windows\run.ps1

# Later starts can reuse the existing build:
.\windows\run.ps1 -NoBuild
```

Use a WPA2-Personal or WPA2/WPA3 mixed network. The computer may use Ethernet; enter the
Wi-Fi credentials for the network the **iPhone** should use. If several network adapters are
active, specify `-BindAddress <receiver-LAN-IPv4>`. No Apple USB driver is needed for this path.
Stop the receiver with Ctrl+C before starting another instance. See the
[Windows guide](docs/windows-port.md) for adapter selection and troubleshooting.

### macOS

```sh
git clone git@github.com:Cainongw/playport.git
cd playport

# 1. Add the accessory identity (see the section below) — the server refuses to start without it
mkdir -p identity/offline-mfi
cp /path/to/identity.pk8 /path/to/certificate.p7b identity/offline-mfi/

# 2. Build everything
./gradlew build                      # protocol + server and JVM tests
(cd web && npm ci && npm run build)

# 3. Build the Bluetooth bridge (macOS RFCOMM helper)
macos/bt-bridge/build.sh

# 4. Pair the iPhone once (keep Settings > Bluetooth open on the phone)
macos/bt-bridge/bt-bridge --scan
macos/bt-bridge/bt-bridge --pair AA:BB:CC:DD:EE:FF      # confirm the code on the iPhone

# 5. Prepare macOS
#    · System Settings → General → AirDrop & Handoff → turn OFF "AirPlay Receiver"
#    · System Settings → Privacy & Security → Bluetooth → enable your terminal app
#    · Allow incoming connections for java if the firewall asks

# 6. Run the server (use the Wi-Fi name the iPhone is on)
./gradlew :server:run --args="--wireless --wifi-ssid \"YOUR_WIFI\" --wifi-passphrase \"YOUR_PASSWORD\""
```

### Open the viewer

Open the **https://** URL the server prints (it contains an access token) and accept the
self-signed certificate warning once. HTTPS is required because browsers only expose WebCodecs —
the video/audio decoders — in secure contexts. On the iPhone, accept the CarPlay prompt; if it asks
for a code, enter **3939**. The dashboard appears in the browser as soon as the first video frame
arrives.

Other screens on the reachable LAN use the same URL; only the receiver pairs with the phone.
Accept the local certificate on each viewing device, then click/tap the page to enable audio.
For access without a token, see [Configuration](#configuration).

## Accessory identity (required)

The iPhone will only start CarPlay with an **authenticated accessory**. On every connection it
requests the accessory certificate and sends a challenge; PlayPort signs it with the matching
private key. AirPlay setup uses the same identity. Without these two files the server exits at
startup, and there is no software workaround.

PlayPort does **not** ship this identity — it is third-party key material, it is not relicensed as
source code, and it must not be redistributed.

### Where the files go

```
identity/offline-mfi/identity.pk8       # PKCS#8 EC P-256 private key
identity/offline-mfi/certificate.p7b    # accessory certificate (Apple Accessories CA)
```

`identity/` is ignored by Git. To keep it somewhere else, pass `--identity-dir /path/to/identity`.
You can verify a pair at any time with the bundled test — it signs a challenge and checks it
against the certificate:

```sh
./gradlew :server:test --tests '*MfiIdentityTest*'
```

### Where to normally find it

1. **From a DiPlay release APK (easiest public source).** DiPlay bundles an experimental identity
   recovered from Carlinkit firmware and documents that it is extractable by design:

   ```sh
   mkdir -p build
   curl -L -o build/DiPlay.apk \
     https://github.com/shihabal3amri/DiPlay/releases/download/v0.2.7/DiPlay-0.2.7.apk
   unzip -j build/DiPlay.apk 'assets/offline-mfi/*' -d identity/offline-mfi
   ```

   See DiPlay's `docs/THIRD_PARTY_NOTICES.md` for provenance.

   On Windows, open the APK with an archive utility and copy the two files from
   `assets/offline-mfi/` into `identity/offline-mfi/`. Keep downloaded APKs under the
   ignored `build/` directory.

2. **From Carlinkit C2Air firmware.** The pair was originally recovered from public Allwinner V821
   firmware. The reverse-engineering community documents how to dump and unpack these dongles —
   for example [ludwig-v/wireless-carplay-dongle-reverse-engineering](https://github.com/ludwig-v/wireless-carplay-dongle-reverse-engineering)
   and the projects it links. Search the unpacked root filesystem for an Apple-issued X.509
   certificate and a matching PKCS#8 EC key.

3. **Your own MFi credentials.** If you are an MFi licensee with an accessory identity, use your own
   certificate and key. A physical MFi authentication coprocessor is not supported by this project.

4. **A remote MFi server.** If you run an authentication service, point PlayPort at it instead of a
   local identity: `--mfi-server https://host --mfi-token <token>`.

> **Caveats.** The publicly available identity is shared, experimental and **not** issued to
> PlayPort. Apple can revoke it in any iOS update, and this is **not an Apple-certified product**.
> Use it for personal experimentation, do not sell it, and do not commit or redistribute the key.

## Display, orientation and quality

The phone renders CarPlay at whatever resolution PlayPort advertises, so the **Display** panel in
the browser is the quality control room:

- **Landscape presets** — 800×480, 1280×720, 1920×720, 1920×1080, 2560×1440, 3840×2160.
- **Portrait presets** — 720×1280, 1080×1920 (portrait is simply `height > width`).
- **CarPlay UI size** — Smaller/Small/Default/Large requests a proportionally larger canvas, so
  CarPlay draws finer controls (75–115%).
- **Video codec** — H.265/HEVC is sharper at the same bitrate and is offered when the browser can
  decode it (probed with `VideoDecoder.isConfigSupported`). The phone makes the final call.
- **Frame rate** — 60 fps for smoothness, 30 fps to spend more bitrate on detail.
- **Match this window** — advertises your window's *physical* pixels (`CSS × devicePixelRatio`), so
  the canvas maps 1:1 to the display. Best used fullscreen.
- **Full screen** — next to Focus mode, enters native browser fullscreen, requests this
  screen's physical resolution and hides all viewer bars and control menus. Larger screens
  are fitted within the receiver's 3840-pixel edge limit while preserving their aspect ratio.
  The existing frame rate, codec and UI size are retained; unchanged dimensions do not reconnect.
  Press Esc or reveal the corner exit button by moving the pointer/touching the page to exit.
  Exiting restores the page layout and keeps the requested resolution.

Applying a change restarts CarPlay (the phone reconnects in a few seconds), and affects every
viewer of the shared session. Values persist in the server state directory. The same knobs
exist as flags for a fixed setup:

```sh
./gradlew :server:run --args="--width 1920 --height 720 --fps 60 --ui-scale 85 --hevc"
```

## Audio and microphone

Audio is passed through per stream (media, guidance, speech, telephony) and decoded in the browser
with a jitter buffer. The **Audio** panel has a master volume and per-stream sliders; the control
dock has **Call** (answer/end) and **Mute call**, and the sidebar has **Night** (day/night mode). When the phone
opens Siri or a call, the browser asks for microphone permission and sends audio back to the phone.
Click or tap the page once to enable sound. Music uses a 600 ms initial buffer to absorb wireless
delivery bursts; voice uses a shorter 120 ms buffer. Windows music output is verified;
microphone capture, Siri conversations and calls still need hardware validation.

## Controls

| Input | Action |
|---|---|
| Touch / mouse drag | CarPlay touch (two contacts supported) |
| Arrow keys | Rotary knob (up/down/left/right) |
| Enter | Select |
| Esc / Backspace | Back (Esc exits immersive fullscreen first) |
| Space | Play / pause |
| S | Siri |
| Viewer controls | Home, Back, Select, media transport, Siri, Call, Mute call, Night, Audio, Display, Refresh video, Focus mode, Fullscreen |

Use **Guide** for connection steps and keyboard shortcuts. **Focus mode** hides the header and
sidebar while keeping the CarPlay controls within reach.

## Configuration

Server options can be given as CLI flags; saved settings are defaults and CLI flags take
precedence. The default state file is `~/.playport/config.json`; the Windows launcher uses
`state/windows-wireless/config.json` inside the checkout. Run the JVM server with `--help`
for the full list. The PowerShell launcher's options are documented in the [Windows guide](docs/windows-port.md).

| Flag | Description | Default |
|---|---|---|
| `--device-name <name>` | Name shown on the iPhone | `PlayPort` |
| `--model`, `--manufacturer` | Strings advertised to the phone | `playport` |
| `--airplay-port <n>` | AirPlay RTSP port | `7000` |
| `--http-port <n>` | Browser UI port (HTTPS) | `8080` |
| `--width`, `--height`, `--fps`, `--ui-scale`, `--hevc` | Display defaults | `1280×720@60`, 100%, H.264 |
| `--rhd` | Right-hand-drive layout | off |
| `--bind <address>` | Bind address | auto-detect LAN |
| `--identity-dir <path>` | Directory containing `offline-mfi/` | `./identity` |
| `--state-dir <path>` | Identity, pairings, TLS, config | `~/.playport` |
| `--mfi-server`, `--mfi-token` | Remote MFi service instead of local keys | — |
| `--wireless` | Enable the Bluetooth/Wi-Fi bootstrap | off |
| `--wifi-ssid`, `--wifi-passphrase`, `--wifi-channel`, `--wifi-security` | Network handed to the phone | auto-detect SSID |
| `--bt-address <mac>` | iPhone Bluetooth address | auto-discovered |
| `--bt-bridge <path>` | Bluetooth helper binary | Platform-specific; Windows launcher selects its built helper |
| `--mdns <backend>` | `auto`, `dns-sd` or `jmdns` | `auto` (dns-sd on macOS) |
| `--http` | Serve plain HTTP (WebCodecs then only works on localhost) | off |
| `--token <token>` | Fixed browser access token | random per start |
| `--no-auth` | Allow browser viewing and control without a token | off |
| `--require-auth` | Require a token even if saved `noAuth` is enabled | — |

Other devices on the same reachable LAN can open the HTTPS viewer URL printed by
the server; only the receiving computer pairs with the iPhone. To use a plain viewer
URL without `?token=...`, set `"noAuth": true` in the local state `config.json` or pass
`--no-auth` and restart. The web client discovers this mode automatically. HTTPS and
MFi authentication remain in use. In this mode anyone who can reach the web port can
view and control CarPlay, including display settings. Use `--require-auth` or save
`"noAuth": false` and restart to restore token protection.

With the Windows launcher, use `-NoAuth` or `-RequireAuth` for these overrides:

```powershell
.\windows\run.ps1 -NoBuild -NoAuth
.\windows\run.ps1 -NoBuild -RequireAuth
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Windows finds no paired iPhone | Pair in Windows Settings first. For a renamed phone or multiple phones, set `bluetoothDeviceAddress` in the local config; the helper's `--list` shows paired addresses. |
| Windows reports an ambiguous LAN address | Pass `-BindAddress <receiver-LAN-IPv4>` to `windows/run.ps1`. |
| Another screen cannot open the page | Use the receiver's printed LAN URL, check firewall access and router client isolation. The launcher does not change firewall rules. |
| Video works but the browser is silent | Click/tap to enable audio, check the Audio panel and system output, then start music in CarPlay. Use Ctrl+F5 after updating the web build. |
| `bt-bridge` aborts immediately (`SIGABRT`) | macOS Bluetooth privacy. System Settings → Privacy & Security → Bluetooth → enable your terminal app. |
| iPhone never appears in Bluetooth settings | Expected — macOS hides iPhones. Pair with `macos/bt-bridge/bt-bridge --pair <address>` (with Settings → Bluetooth open on the phone). |
| `--pair` hangs | The device is already paired; just start the server, or use `--force-pair` to re-bond. |
| `no Wi-Fi network detected` | macOS hides the SSID from processes without Location Services, or the Wi-Fi is on another interface. Pass `--wifi-ssid` and `--wifi-passphrase`, or grant Location Services to your terminal. |
| Phone connects but video is black | Open the **https://** URL (WebCodecs needs a secure context) and hard-refresh. Press **Fix video** to force a keyframe. |
| `H.265/HEVC … cannot decode` | Your browser lacks HEVC. Switch the codec back to H.264 in the Display panel. |
| No CarPlay prompt on the iPhone | Check the phone joined the same Wi-Fi. Remove stale entries in iPhone Settings → General → CarPlay, then let the supervisor retry (or restart the server). |
| Port 7000 already in use | macOS AirPlay Receiver is on. System Settings → General → AirDrop & Handoff → turn it off. |
| Browser warns about the certificate | Expected: the server generates a self-signed certificate in its state directory. Accept it once. |
| Stream resolution lower than requested | The iPhone clamps to what its encoder supports; the header HUD shows what actually arrived. |

## Security and privacy

- The server binds the AirPlay port to your LAN address; the browser UI is HTTPS with a
  self-signed certificate. A token is required by default (regenerated every start
  unless `--token` is set); `--no-auth` explicitly disables browser token checks.
- The MFi private key never leaves the machine and is never sent to the browser; it is only used to
  sign the iPhone's challenge.
- State files live in `~/.playport` (Windows launcher: `state/windows-wireless/`), with owner-only
  permissions where the filesystem supports it. Wi-Fi credentials and pairing records stay there.
- Nothing is uploaded anywhere. Diagnostics are local. Pair records stay on your machine.
- Treat the machine as you would a car head unit: anyone on your LAN with the token can control
  CarPlay while your iPhone is connected. With `--no-auth`, the token is not needed.

## Project layout

```
protocol/   Kotlin/JVM library ported from DiPlay's shared module (AirPlay, iAP2, MFi, streams)
server/     Ktor server: RTSP + mDNS + Bluetooth bridge + WebSocket hub + display/mic/config APIs
web/        Vite + TypeScript browser client (WebCodecs video/audio, input, panels)
macos/      bt-bridge: Swift IOBluetooth RFCOMM helper for the wireless bootstrap
windows/    PowerShell launcher, local config example and .NET Windows RFCOMM bridge
identity/   Accessory identity drop-in (gitignored — see above)
docs/       Windows guide, logo and screenshots
```

## Development

From the repository root on macOS:

```sh
./gradlew build            # compiles both modules and runs JVM tests
(cd web && npm run build)  # type-checks and bundles the browser client
(cd web && npm test)       # input, audio buffering, access policy and fullscreen regressions
./gradlew :server:run --args="--help"
```

On Windows:

```powershell
.\gradlew.bat --console=plain build :server:installDist
.\windows\bt-bridge\build.ps1
Push-Location web
npm ci
npm run build
npm test
Pop-Location
```

The Windows launcher takes a private copy of the built JARs and bridge under the ignored
`build/windows-runtime/` directory, so another build cannot replace a running JVM's libraries.
These snapshots are local build artifacts. Frontend changes require a browser refresh.

The `protocol` module is a faithful port of DiPlay's `shared` sources with Android dependencies
replaced by small JVM shims (`platform/Log`, `network/TcpLiveness`, `transport/IphoneUsbException`),
so future upstream fixes stay easy to merge. `MfiIdentityTest` validates the local identity against
its certificate (the identity check skips when no local identity directory exists); `WireTest`
covers browser framing. Additional regressions cover touch contact slots, audio capability
advertisement and protected/open viewer access. Real-device testing is still needed for
Bluetooth, iPhone routing and browser playback.

## Status and limitations

PlayPort is **experimental**. Upstream reports macOS validation for wireless bootstrap,
MFi authentication, video, touch and display switching. This fork has additionally been tested
on Windows 11 x64 with an iPhone running iOS 27.2:

| Windows feature | Status |
|---|---|
| Bluetooth/iAP2 bootstrap, MFi and AirPlay session | Verified on one setup |
| H.264 video and multiple LAN viewers | Verified |
| Touch, quick clicks and Music's back arrow | Verified |
| Apple Music audio through the browser | Verified; buffering avoids observed playback gaps |
| Display changes, fullscreen and token-free access | Verified |
| Microphone uplink, calls, HEVC and extended reconnect/stability | Need hardware validation |

- Not an Apple-certified product; the public identity is shared and can be revoked by Apple.
- Wired USB CarPlay is not supported; wireless only.
- Linux has no bundled Bluetooth bridge and is not supported yet.
- Telephony buttons are implemented but their HID indexes are unverified in DiPlay — report if
  **Call** does nothing during a call.
- H.265/HEVC requires a working HEVC WebCodecs decoder on the viewing device; H.264 is the
  validated Windows baseline. Fullscreen also depends on browser support.
- iOS behavior can change with any update; this project may break without warning.

## Credits and license

PlayPort is free software under the **GNU General Public License v3.0** — see [LICENSE](LICENSE).
As a derivative of DiPlay and xcertplay (both GPL-3.0), it must remain under the same license: you
may use, study, modify and share it, but distributed copies and modifications must keep this
license and make their source available.

- Protocol stack: [DiPlay](https://github.com/shihabal3amri/DiPlay) by shihabal3amri and
  [xcertplay](https://github.com/shilapi/xcertplay) by shilapi.
- Original JVM server and browser client: [PlayPort](https://github.com/youcci/playport) by youcci.
- The accessory identity discussed above was recovered from public Carlinkit C2Air firmware during
  the DiPlay project's investigation and is not part of this repository.
- Interface inspiration: [DiAuto](https://github.com/shihabal3amri/DiAuto) (AGPL-3.0) — no code from
  it is used here.

CarPlay, iPhone, AirPlay and MFi are trademarks of Apple Inc. PlayPort is an independent project;
no Apple affiliation or endorsement is implied.

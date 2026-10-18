# PlayPort

<div align="center">

<img src="docs/playport-logo.svg" alt="PlayPort" width="320" />

**在浏览器中使用无线 CarPlay。**

[![许可证：GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![平台：Windows 和 macOS](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#环境要求)
[![状态：实验性](https://img.shields.io/badge/status-experimental-orange.svg)](#验证状态与限制)

[English](README.md) · **简体中文**

</div>

![PlayPort CarPlay 界面](docs/screenshots/dashboard.jpg)

PlayPort 在 Windows 或 macOS 上运行 CarPlay 接收端。iPhone 先通过蓝牙完成连接初始化，
随后经局域网传输画面和声音。使用兼容的浏览器打开网页，就能查看并操控 CarPlay。
电脑可以接网线，iPhone 使用同一可互通局域网中的 Wi-Fi，无需 CarPlay 盒子或 iPhone 应用。

本分支增加了 Windows 蓝牙桥接程序和启动脚本，修复了触控松手与音乐播放问题，
并提供可选的免 token 访问和自动匹配分辨率的完整全屏模式。
Windows 的画面、触控、音乐、多设备访问及全屏已在一套 Windows 11 环境中验证；
麦克风、通话和长时间稳定性仍待验证。**目前不支持 USB 有线 CarPlay。**

> **代码来源。** PlayPort 的 AirPlay、iAP2 和配件认证代码移植自
> shihabal3amri 的 [DiPlay](https://github.com/shihabal3amri/DiPlay)，
> 后者基于 shilapi 的 [xcertplay](https://github.com/shilapi/xcertplay)，均使用 GPL-3.0。
> 原始 JVM 服务端和浏览器客户端来自 youcci 的
> [PlayPort](https://github.com/youcci/playport)。
> 本项目独立开发，不代表上述作者或 Apple，也未获得其背书。

## 目录

- [工作方式](#工作方式)
- [主要功能](#主要功能)
- [界面截图](#界面截图)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [配件认证材料](#配件认证材料)
- [其他设备与 token 鉴权](#其他设备与-token-鉴权)
- [分辨率与全屏](#分辨率与全屏)
- [音频与操作](#音频与操作)
- [配置](#配置)
- [常见问题](#常见问题)
- [安全与隐私](#安全与隐私)
- [目录与开发](#目录与开发)
- [验证状态与限制](#验证状态与限制)
- [致谢与许可证](#致谢与许可证)

## 工作方式

```text
iPhone
  │
  ├─ 蓝牙 RFCOMM：iAP2 初始化、MFi 认证、Wi-Fi 信息交接
  │
  └─ Wi-Fi / 局域网：AirPlay 视频、音频、控制
          │
          ▼
   PlayPort 服务端（Kotlin/JVM + Ktor）
   解密媒体、维护连接、转发触控与控制指令
          │
          │ HTTPS + WebSocket
          ▼
   浏览器（TypeScript + WebCodecs + Web Audio）
   解码画面与声音，接收鼠标、触摸及键盘输入
```

服务端直接把 iPhone 编码后的媒体传给浏览器，不进行视频解码或重新编码。
平台差异集中在蓝牙桥接层：macOS 使用 Swift/IOBluetooth，Windows 使用 .NET/Windows RFCOMM；
协议、MFi 和媒体处理继续复用 Kotlin 代码。

## 主要功能

- **无线连接**：蓝牙完成初始化，现有局域网传输媒体，并在连接断开后尝试重新邀请手机。
- **多设备查看**：同一局域网内的兼容浏览器可访问同一个 CarPlay 会话。
- **触控和旋钮操作**：支持鼠标、最多两点触控、方向键、媒体按钮、Home 和 Back。
- **显示设置**：分辨率、横竖屏、帧率、CarPlay 界面大小及 H.264/HEVC 选择。
- **完整全屏**：一键进入浏览器全屏、申请当前屏幕分辨率，并隐藏页面菜单。
- **音频混音**：总音量与音乐、导航、语音/通话等音频流的独立音量。
- **麦克风上行**：手机请求 Siri 或通话音频时，浏览器申请麦克风权限；Windows 实机验证待完成。
- **配置持久化**：服务端保存显示和连接设置，浏览器保存音量。
- **可选免 token 访问**：默认要求 token，也可在受信任的局域网内主动关闭。
- **本地运行**：不需要 PlayPort 云服务或账号。

## 界面截图

| 显示设置 | 音频混音 |
|---|---|
| ![显示设置](docs/screenshots/display-panel.jpg) | ![音频面板](docs/screenshots/audio-controls.jpg) |
| **Focus mode** | **移动端界面** |
| ![专注模式](docs/screenshots/focus-mode.jpg) | <img src="docs/screenshots/mobile.jpg" alt="移动端界面" width="250" /> |

## 环境要求

| 组件 | 要求 |
|---|---|
| 服务端系统 | Windows 11 x64（已验证），或 macOS 13+（上游平台） |
| Java | 构建使用 JDK 25；生成的 JVM 代码目标为 Java 21 |
| Windows 构建工具 | .NET 10 SDK，用于蓝牙桥接程序 |
| macOS 构建工具 | Xcode Command Line Tools，可运行 `xcode-select --install` 安装 |
| 网页构建 | Node.js 22.12+ 和 npm；锁定的 Vite 版本也接受 Node.js 20.19+ |
| 浏览器 | 支持 HTTPS、WebCodecs 视频/音频解码；建议先使用 Chrome/Edge 和 H.264 验证 |
| iPhone | 支持 CarPlay，开启蓝牙和 Wi-Fi |
| 网络 | 电脑与 iPhone 可通过局域网互通，电脑蓝牙已开启；电脑可使用以太网 |
| 认证材料 | 单独提供匹配的 MFi 证书与私钥，仓库不包含这些文件 |

## 快速开始

### Windows

先安装上面的构建依赖，在 **Windows 设置 → 蓝牙和设备 → 添加设备** 中与 iPhone 配对。
配对时保持 iPhone 的 **设置 → 蓝牙** 页面打开，并确认两端的配对码。

在 PowerShell 中执行：

```powershell
git clone git@github.com:Cainongw/playport.git
cd playport

# 1. 准备 identity/offline-mfi/identity.pk8 和 certificate.p7b，获取方式见下文。

# 2. 创建本地配置。已有配置时不要重复覆盖。
New-Item -ItemType Directory -Path state/windows-wireless -Force
Copy-Item windows/config.example.json state/windows-wireless/config.json
notepad state/windows-wireless/config.json
# 填写 wifiSsid、wifiPassphrase，保存后关闭编辑器。

# 3. 构建服务端、蓝牙桥接和网页，并启动。
.\windows\run.ps1

# 后续启动可复用已有构建。
.\windows\run.ps1 -NoBuild
```

填写的是 **iPhone 将连接的 Wi-Fi** 的名称和密码。当前路径使用 WPA2-Personal 或
WPA2/WPA3 混合网络；电脑可以通过网线接入同一局域网，无需安装 Apple USB 驱动。

如存在多个活动网卡，使用 `-BindAddress <电脑的局域网IPv4>` 指定监听地址。
按 Ctrl+C 停止服务后再启动新实例。脚本会检查重复运行和端口占用。
更多说明见 [Windows 使用指南](docs/windows-port.md)。

自动选手机时会匹配名称中包含 `iPhone` 的已配对设备。手机改名或已配对多台手机时，
在本地配置中添加 `"bluetoothDeviceAddress": "AA:BB:CC:DD:EE:FF"`。
构建后可用 `build/windows-bt-bridge/bt-bridge.exe --list` 查看地址。

### macOS

```sh
git clone git@github.com:Cainongw/playport.git
cd playport

# 1. 放入配件认证文件。
mkdir -p identity/offline-mfi
cp /path/to/identity.pk8 /path/to/certificate.p7b identity/offline-mfi/

# 2. 构建服务端、网页和蓝牙桥接。
./gradlew build
(cd web && npm ci && npm run build)
macos/bt-bridge/build.sh

# 3. 与手机配对；保持 iPhone 的“设置 → 蓝牙”页面打开。
macos/bt-bridge/bt-bridge --scan
macos/bt-bridge/bt-bridge --pair AA:BB:CC:DD:EE:FF

# 4. 启动，填写手机使用的 Wi-Fi。
./gradlew :server:run --args="--wireless --wifi-ssid \"YOUR_WIFI\" --wifi-passphrase \"YOUR_PASSWORD\""
```

启动前，在 macOS **系统设置 → 通用 → 隔空投送与接力** 中关闭“隔空播放接收器”，
在 **隐私与安全性 → 蓝牙** 中允许终端使用蓝牙，并按防火墙提示允许 Java 接收入站连接。

### 打开网页

打开终端输出的 **HTTPS 地址**，默认地址带有访问 token。
首次访问需要自行处理本地自签名证书提示；WebCodecs 需要安全上下文。
在 iPhone 上接受 CarPlay 提示，如要求输入 CarPlay PIN，使用 **3939**。

画面出现后，点击或触摸一次网页以启用浏览器音频。
其他设备的连接方式和免 token 配置见下文。

## 配件认证材料

iPhone 会请求配件证书并发送挑战，PlayPort 使用匹配的私钥签名完成 MFi 认证。
本地运行需要以下文件，或配置可用的远程 MFi 服务：

```text
identity/offline-mfi/identity.pk8       # PKCS#8 格式的 EC P-256 私钥
identity/offline-mfi/certificate.p7b    # 配件证书
```

这些第三方认证材料**不包含在仓库中**，也不随源码许可证重新授权。
`identity/` 下的认证文件已被 Git 忽略，请勿提交或重新分发。
自定义位置可用 `--identity-dir <目录>` 指定，该目录下仍应包含 `offline-mfi/`。

DiPlay 的公开发行 APK 包含从 Carlinkit 固件中恢复的实验性身份。
以下为其 v0.2.7 版本的提取方式，来源说明见 DiPlay 的 `docs/THIRD_PARTY_NOTICES.md`：

```sh
mkdir -p build
curl -L -o build/DiPlay.apk \
  https://github.com/shihabal3amri/DiPlay/releases/download/v0.2.7/DiPlay-0.2.7.apk
unzip -j build/DiPlay.apk 'assets/offline-mfi/*' -d identity/offline-mfi
```

Windows 可用压缩软件打开该 APK，从 `assets/offline-mfi/` 中提取上述两个文件，
放到项目的 `identity/offline-mfi/`。下载的 APK 也应保存在 Git 忽略的 `build/` 目录中。

也可以使用自己持有的 MFi 配件身份，或通过
`--mfi-server https://host --mfi-token <token>` 连接远程认证服务。
当前未接入物理 MFi 认证芯片。更多来源信息见[英文说明](README.md#accessory-identity-required)。

公开身份是共享的实验材料，并非签发给 PlayPort；它可能随 iOS 更新失效。
本项目不是 Apple 认证产品。

本地证书与私钥的匹配检查：

```powershell
.\gradlew.bat :server:test --tests '*MfiIdentityTest*'
```

macOS 使用 `./gradlew`。缺少本地身份目录时，签名检查会跳过；
测试通过不等于已经安装认证材料，也不等于完成了手机端认证。

## 其他设备与 token 鉴权

其他电脑、平板等设备连接可访问接收端的局域网，然后打开服务端打印的同一 HTTPS 地址。
只有接收端电脑需要与 iPhone 配对，其他设备无需运行接收服务或配对手机。
每台设备都要处理证书提示，并点击网页启用声音。

默认开启 token 鉴权。要使用不带 `?token=...` 的地址，将本地配置中的
`"noAuth": false` 改为 `"noAuth": true`，然后重启服务。
也可使用 Windows 启动参数：

```powershell
# 关闭浏览器 token 校验。
.\windows\run.ps1 -NoBuild -NoAuth

# 强制恢复 token 校验，覆盖已保存的免鉴权设置。
.\windows\run.ps1 -NoBuild -RequireAuth
```

直接启动 JVM 时，对应参数为 `--no-auth` 和 `--require-auth`。
命令行设置优先于配置文件；保存显示设置时也可能一并持久化当前鉴权模式。
要持久恢复保护，可保存 `"noAuth": false` 后重启。

免 token 模式下，任何能访问网页端口的设备都能查看、操作 CarPlay 和修改分辨率。
该开关只影响浏览器 token 校验，HTTPS 与 MFi 认证仍然保留。

## 分辨率与全屏

浏览器 **Display** 面板提供：

- 横屏、竖屏及多种分辨率预设，最高预设为 3840×2160。
- 30/60 fps 请求、CarPlay 界面大小和 H.264/HEVC 选择。
- **Match this window**：按窗口 CSS 尺寸乘设备像素比，申请对应物理像素尺寸。
- **Full screen**：位于 **Focus mode** 旁，先进入浏览器原生全屏，再自动申请当前设备分辨率。

Full screen 会隐藏顶部、侧边和底部菜单；较大的屏幕按比例缩放到每边最多 3840 像素，
并保留原有帧率、编码和界面大小。按 **Esc**，或移动鼠标/触摸后点击右上角退出按钮，
可恢复原页面或 Focus mode 布局。退出后保留已申请的分辨率。

分辨率属于整个 CarPlay 会话：修改后手机会短暂重连，所有观看设备都会受影响。
尺寸未变化时，全屏不会触发重新连接。手机可能限制实际输出规格；
请求的帧率和分辨率不代表设备一定按该规格持续输出。
浏览器不支持或拒绝全屏时，不会提交分辨率变更。

## 音频与操作

音乐、导航、Siri 和通话音频按流转发，由浏览器解码。
**Audio** 面板可调总音量和各路音量。首次使用请点击/触摸网页启用声音。

音乐使用约 600 ms 的初始缓冲来吸收无线数据的突发到达，语音保留 120 ms 缓冲。
Windows 的 Apple Music 输出已经验证；麦克风采集、Siri 对话及通话仍需实机验证。
当手机请求语音/通话输入时，浏览器才会申请麦克风权限。

| 输入 | 操作 |
|---|---|
| 触摸、鼠标点击与拖动 | CarPlay 触控，最多两点 |
| 方向键 | 旋钮方向输入 |
| Enter | 选择 |
| Esc / Backspace | 返回；完整全屏中 Esc 优先退出全屏 |
| Space | 播放/暂停 |
| S | Siri |
| 网页按钮 | Home、Back、Select、媒体控制、Siri、Call、Mute call、Night 等 |

**Focus mode** 隐藏页头和侧栏，保留常用控制；**Full screen** 隐藏全部常驻菜单。
**Guide** 中可查看连接步骤与快捷键。

## 配置

Windows 启动脚本默认读取项目内 `state/windows-wireless/config.json`，
直接启动 JVM 时默认使用 `~/.playport/config.json`。
显示修改会保存到当前状态目录，命令行参数优先于已保存设置。

| JVM 参数 | 用途 | 默认值 |
|---|---|---|
| `--device-name <name>` | iPhone 上看到的接收端名称 | `PlayPort` |
| `--airplay-port <n>` | AirPlay RTSP 端口 | `7000` |
| `--http-port <n>` | 浏览器 HTTPS 端口 | `8080` |
| `--width`、`--height`、`--fps`、`--ui-scale`、`--hevc` | 显示设置 | 1280×720、60 fps、100%、H.264 |
| `--bind <address>` | AirPlay 监听地址 | 自动选择局域网 |
| `--identity-dir <path>` | 含 `offline-mfi/` 的认证目录 | `./identity` |
| `--state-dir <path>` | 设置、配对与 TLS 状态目录 | `~/.playport` |
| `--wireless` | 启用蓝牙/Wi-Fi 初始化 | 关闭；Windows 示例配置已开启 |
| `--wifi-ssid`、`--wifi-passphrase` | 交给手机的 Wi-Fi 信息 | Windows 本地配置填写 |
| `--bt-address <mac>` | 指定 iPhone 蓝牙地址 | 自动查找 |
| `--bt-bridge <path>` | 平台蓝牙桥接程序 | 按平台选择 |
| `--mdns <backend>` | `auto`、`dns-sd` 或 `jmdns` | Windows 脚本选择 `jmdns` |
| `--token <token>` | 固定浏览器 token | 每次启动随机生成 |
| `--no-auth` / `--require-auth` | 关闭/强制开启浏览器 token 校验 | 默认开启校验 |
| `--http` | 使用普通 HTTP | 关闭；远程 WebCodecs 需要 HTTPS |

完整 JVM 参数见 `--help`。Windows 脚本另支持 `-BindAddress`、`-StateDir`、
`-Token`、`-NoAuth`、`-RequireAuth`、`-NoBuild`；
脚本参数与 JVM 参数格式不同，详见 [Windows 使用指南](docs/windows-port.md)。

## 常见问题

| 问题 | 排查方式 |
|---|---|
| Windows 找不到手机 | 先在系统设置中配对；手机改名或有多台手机时指定 `bluetoothDeviceAddress` |
| Windows 提示 LAN 地址不明确 | 通过 `-BindAddress` 指定电脑的物理网卡 IPv4 |
| Windows 保留了 AirPlay 7000 端口 | 启动脚本会检测系统保留端口，自动选择可用备用端口，并通过 mDNS 告知 iPhone |
| 其他设备打不开网页 | 使用终端打印的局域网地址，检查防火墙和路由器客户端隔离；脚本不自动修改防火墙 |
| 没有 CarPlay 提示 | 检查 Wi-Fi 配置和网络互通，查看 iPhone 的“设置 → 通用 → CarPlay” |
| 页面黑屏 | 使用 HTTPS，处理证书提示，先选 H.264；更新后按 Ctrl+F5 |
| 浏览器无声 | 点击网页解锁音频，检查 Audio 面板及系统输出设备，再从 CarPlay 内播放音乐 |
| HEVC 无法解码 | 当前浏览器/设备缺少相应解码能力，改回 H.264 |
| 证书警告 | 服务端使用本地生成的自签名证书，首次访问时自行确认 |
| macOS 端口 7000 被占用 | 关闭系统“隔空播放接收器” |
| macOS 蓝牙桥接立即退出 | 在“隐私与安全性 → 蓝牙”中允许终端使用蓝牙 |
| PowerShell 禁止运行脚本 | 遵循本机允许的执行策略；启动脚本不会修改系统策略 |
| 请求规格高于实际画面 | iPhone 编码能力可能限制输出，查看页面统计中的实际值 |

AirPlay 除默认 TCP 7000 和网页 TCP 8080 外还会协商媒体端口；
只开放这两个 TCP 端口不一定足以传输所有媒体。

## 安全与隐私

- 浏览器访问默认使用 HTTPS 和 token。关闭 token 后，应自行限制可访问该端口的网络范围。
- 本地 MFi 私钥不会发送到浏览器，只用于认证签名。
- Wi-Fi 信息、配对记录和 TLS 材料保存在本地状态目录中；不要将其提交到 Git。
- `identity/` 中的认证材料、`state/`、构建输出和本地诊断文件已被忽略。
- PlayPort 接收服务不向云端上传媒体或诊断记录。

## 目录与开发

```text
protocol/   Kotlin/JVM 协议库：AirPlay、iAP2、MFi、媒体流
server/     Ktor 服务端：RTSP、mDNS、蓝牙桥接、WebSocket、配置 API
web/        TypeScript/Vite 客户端：WebCodecs、音频、输入和界面
macos/      Swift IOBluetooth 蓝牙桥接
windows/    PowerShell 启动脚本、配置模板、.NET Windows 蓝牙桥接
identity/   本地认证文件（认证材料不纳入 Git）
docs/       Windows 指南、图标和截图
```

Windows 开发检查：

```powershell
.\gradlew.bat --console=plain build :server:installDist
.\windows\bt-bridge\build.ps1
Push-Location web
npm ci
npm run build
npm test
Pop-Location
```

macOS 使用 `./gradlew build`、`macos/bt-bridge/build.sh` 和相同的 npm 命令。

Windows 启动脚本会把 JAR 和桥接程序复制到独立的 `build/windows-runtime/` 目录再运行，
避免后续构建覆盖正在使用的文件。仅在对应服务进程停止后清理旧运行副本。
网页继续从 `web/dist/` 提供，前端更新后需要刷新浏览器。

JVM 回归检查包括触控槽位、音频能力声明、HTTP/WebSocket 鉴权等；
前端回归检查包括快速点击、音频缓冲、访问模式和全屏行为。
这些自动检查不能替代真实手机、蓝牙及浏览器的端到端验证。

## 验证状态与限制

Windows 11 x64 与一台运行 iOS 27.2 的 iPhone 上已验证：

| 功能 | 状态 |
|---|---|
| 蓝牙/iAP2 初始化、MFi、AirPlay 会话 | 已验证 |
| H.264 画面、多设备局域网查看 | 已验证 |
| 触控、快速点击、Music 界面返回箭头 | 已验证 |
| Apple Music 经浏览器播放 | 已验证，缓冲调整后播放流畅 |
| 显示设置、自动分辨率全屏、免 token 访问 | 已验证 |
| 麦克风、通话、HEVC、长时间重连及稳定性 | 待进一步实机验证 |

上游已有 macOS 无线初始化、MFi、画面、触控和显示切换的验证记录，
本分支未对所有 macOS 功能重新进行硬件验证。

- 项目仍处于实验阶段，不是 Apple 认证产品，iOS 更新可能改变协议行为。
- **USB 有线 CarPlay 尚未实现**；iAP2/MFi 通道可用并不代表 USB 媒体网络已打通。
- Linux 尚无内置蓝牙桥接实现。
- HEVC、WebCodecs 和原生全屏均取决于观看设备及浏览器能力。
- 通话按键的 HID 索引在上游仍存在未验证项；麦克风和通话不能据此保证可用。

## 致谢与许可证

本项目使用 **GNU GPL v3.0**，见 [LICENSE](LICENSE)，保留 DiPlay、xcertplay 和原始 PlayPort
的来源与许可证说明。

- 原始桌面服务端和网页：[youcci/PlayPort](https://github.com/youcci/playport)。
- 协议栈：[shihabal3amri/DiPlay](https://github.com/shihabal3amri/DiPlay)、
  [shilapi/xcertplay](https://github.com/shilapi/xcertplay)。
- 界面灵感：[DiAuto](https://github.com/shihabal3amri/DiAuto)，未使用其代码。
- 文中提到的配件身份来自 DiPlay 对 Carlinkit C2Air 固件的研究，不属于本仓库。
- Windows Gradle 启动器保留 Gradle 自带的 Apache-2.0 声明。

CarPlay、iPhone、AirPlay 和 MFi 是 Apple Inc. 的商标。本项目与 Apple 无关联，未获得其认可或背书。

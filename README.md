# PingZilla Enhanced

> *An actively maintained, extended fork of PingZilla*

<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="PingZilla Enhanced app icon">
</p>

A lightweight macOS menu bar application that monitors network latency in real time. PingZilla Enhanced builds on the original PingZilla with longer-term history, network-session tracking, and additional diagnostics. It is built with Tauri 2, React, and Rust.

## About This Fork

PingZilla Enhanced is an independently maintained fork of [PixelTowers/Pingzilla](https://github.com/PixelTowers/Pingzilla). It keeps the original project's lightweight menu bar experience while developing additional monitoring and troubleshooting features. Suitable improvements may continue to be proposed upstream.

### What's Different?

- Up to 24 hours of persisted, range-selectable ping history
- Network sessions grouped by public IP and ISP fingerprint
- Custom aliases for recognizing networks at a glance
- User-triggered macOS network quality tests with recent results shown alongside ping history
- Historical graph segmentation, downsampling, and detailed point inspection
- Ongoing fixes and usability improvements beyond the current upstream release

## Why PingZilla Enhanced?

**For Remote Workers & Digital Nomads**
> Working from a café in Lisbon? PingZilla Enhanced alerts you the moment your VPN drops, before your real IP gets exposed. See your current country right in the menu bar.

**For Gamers & Streamers**
> That lag spike just cost you the match. PingZilla Enhanced lives in your menu bar showing real-time latency. Green means go, red means rage quit.

**For Developers**
> A menu bar ping monitor that doesn't eat your battery. Built with Tauri 2 and Rust, not another Electron memory hog. [Open source](https://github.com/rsheyd/pingzilla-enhanced).

## Features

- **Live Menu Bar Display** - Current ping displayed right in your menu bar
- **Dynamic Menu Bar Icons** - PingZilla Enhanced's mood changes based on latency:
  - Happy (< 60ms) - Everything is great!
  - Angry (60-150ms) - Getting concerned...
  - Sad (> 150ms) - Network troubles!
  - Dead (timeout) - No response!
- **IP Geolocation** - See your public IP address and country with flag emoji - perfect for VPN users
- **Site Monitoring** - Monitor up to 10 websites or servers with 60-second check intervals
- **Down Alerts** - Get notified when monitored sites go down
- **Multiple Targets** - Monitor multiple hosts simultaneously
- **Statistics Dashboard** - View min/max/avg latency, uptime percentage, and packet loss
- **Real-Time Graph** - Visual history of the last 2 minutes of ping data
- **Display Mode Options** - Choose what to show in menu bar:
  - Icon + Ping (default)
  - Icon Only
  - Ping Only
- **Smart Notifications** - Get alerted when latency exceeds your threshold (default: 400ms)
- **Configurable Target** - Ping any host (default: 8.8.8.8)
- **Persistent History** - Stores up to 24 hours of ping data locally
- **Smooth Animations** - Buttery smooth number transitions
- **Native Performance** - Rust backend with minimal resource usage
- **No Root Required** - Uses system ping command

## Menu Bar Icons

PingZilla Enhanced uses expressive icons to show network health at a glance:

| Icon | Latency | Mood |
|------|---------|------|
| ![Happy](src-tauri/icons/pingzilla_happy.png) | < 60ms | Happy |
| ![Angry](src-tauri/icons/pinzilla_angry.png) | 60-150ms | Angry |
| ![Sad](src-tauri/icons/pingzilla_sad.png) | > 150ms | Sad |
| ![Dead](src-tauri/icons/pingzilla_dead.png) | Timeout | Dead |

## Screenshots

<p align="center">
  <img src="screenshots/screenshot1.jpeg" width="800" alt="PingZilla Enhanced dashboard">
</p>

<p align="center">
  <img src="screenshots/screenshot3.png" width="400" alt="PingZilla Enhanced popup">
  <img src="screenshots/screenshot2.png" width="400" alt="PingZilla Enhanced menu bar">
</p>

## Installation

### From Release

Download the latest available build from the [Releases](https://github.com/rsheyd/pingzilla-enhanced/releases) page. If no packaged release is available for the version you want, build it from source below.

The original PingZilla is also available from the [Mac App Store](https://apps.apple.com/app/pingzilla/id6757017560). That listing is maintained by the upstream project and is not PingZilla Enhanced.

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)
- Xcode Command Line Tools

#### Steps

```bash
# Clone the repo
git clone https://github.com/rsheyd/pingzilla-enhanced.git
cd pingzilla-enhanced

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/`.

### App Store Build

To build for Mac App Store submission:

```bash
# Full pipeline: build universal binary, sign, and create .pkg
make appstore

# Or step by step:
make universal    # Build universal binary (Intel + Apple Silicon)
make sign         # Sign with Apple Distribution certificate
make pkg          # Create signed installer package
make upload       # Show upload instructions
```

**Prerequisites for App Store:**
1. Apple Developer account
2. App Store provisioning profile (save as `src-tauri/embedded.provisionprofile`)
3. Certificates installed in Keychain:
   - Apple Distribution certificate
   - 3rd Party Mac Developer Installer certificate
4. Apple WWDR intermediate certificate

## Usage

1. **Launch** - PingZilla Enhanced appears in your menu bar showing the current ping
2. **Click** the menu bar icon to open the detailed view with graph
3. **Right-click** to access the quit menu
4. **Settings** - Click "Settings" in the popup to configure:
   - **Target**: The host to ping
   - **Alert threshold**: Latency (in ms) that triggers notifications
   - **Display Mode**: What to show in the menu bar

## Tech Stack

- **Frontend**: React 19, TypeScript, Recharts
- **Backend**: Rust, Tauri 2
- **Build**: Vite, pnpm

## Make Targets

Run `make help` to see all available commands:

| Command | Description |
|---------|-------------|
| `make dev` | Start development server with hot reload |
| `make build` | Build for current architecture |
| `make universal` | Build universal binary (Intel + Apple Silicon) |
| `make appstore` | Full App Store build pipeline |
| `make sign` | Sign app for distribution |
| `make pkg` | Create installer package |
| `make upload` | Show upload instructions |
| `make clean` | Clean build artifacts |
| `make lint` | Run linters |
| `make info` | Show build info |

## Color Indicators

| Color  | Latency    | Status    |
|--------|------------|-----------|
| Green  | < 60ms     | Excellent |
| Yellow | 60-150ms   | Good      |
| Red    | > 150ms    | Poor      |
| Gray   | Timeout    | No response |

## Documentation

- [Contributing and local testing](CONTRIBUTING.md) - Test development changes without removing the installed app
- [Marketing Plan](MarketingPlan.md) - Launch strategy and growth plans

## License

MIT

## Credits

PingZilla Enhanced is maintained by [rsheyd](https://github.com/rsheyd). The original PingZilla was created by Chriszilla and Claudio; see the [upstream project](https://github.com/PixelTowers/Pingzilla) for its contributors and history.

---

*PingZilla Enhanced: Stomping latency with a little more history.*

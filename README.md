# PingZilla Next

<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="PingZilla Next app icon">
</p>

PingZilla Next is a lightweight macOS menu bar app for watching latency, recognizing network changes, and investigating recent connection quality. It combines live ICMP monitoring with 24-hour local history, network sessions, site checks, and user-triggered macOS network quality tests.

<p align="center">
  <img src="screenshots/screenshot1.jpeg" width="800" alt="PingZilla Next dashboard showing current latency and recent history">
</p>

## Project status

PingZilla Next is an independently maintained downstream edition of [PixelTowers/Pingzilla](https://github.com/PixelTowers/Pingzilla). It is not maintained by or affiliated with the upstream maintainers, but suitable fixes and improvements may still be offered upstream.

The current release retains the upstream bundle identifier and local storage namespace for compatibility. Do not run PingZilla and PingZilla Next at the same time because both can write to the same history file. A separate identity and safe data transition are planned in the [identity migration plan](docs/identity-migration.md).

## Highlights

- Live menu bar latency with icon-and-ping, icon-only, and ping-only display modes
- Configurable ICMP targets, ping interval, and high-latency notification threshold
- Up to 24 hours of locally persisted, range-selectable history with statistics and packet loss
- Network sessions grouped by public IP and ISP, with custom names for familiar networks
- User-triggered tests powered by macOS `networkQuality`, stored alongside recent history
- Direct availability checks for up to 10 websites or servers, with down notifications
- Optional public IP, location, ISP, and VPN-change monitoring
- Launch-at-login support and native notifications

The menu bar icon summarizes the latest result:

| Icon | Result | Meaning |
|------|--------|---------|
| <img src="src-tauri/icons/pingzilla_happy.png" height="24" alt="Happy menu bar icon"> | Under 100 ms | Good |
| <img src="src-tauri/icons/pinzilla_angry.png" height="24" alt="Angry menu bar icon"> | 100–149 ms | Elevated |
| <img src="src-tauri/icons/pingzilla_sad.png" height="24" alt="Sad menu bar icon"> | 150 ms or more | Poor |
| <img src="src-tauri/icons/pingzilla_dead.png" height="24" alt="Dead menu bar icon"> | Timeout | No response |

## Requirements and installation

PingZilla Next requires macOS 12 or later.

Download a packaged build from [GitHub Releases](https://github.com/rsheyd/pingzilla-next/releases) when one is available. The [Mac App Store listing](https://apps.apple.com/app/pingzilla/id6757017560) belongs to the upstream PingZilla project and does not install PingZilla Next.

To build the current source yourself, install Node.js 18 or later, [pnpm](https://pnpm.io/), [Rust](https://rustup.rs/), and the Xcode Command Line Tools, then run:

```bash
git clone https://github.com/rsheyd/pingzilla-next.git
cd pingzilla-next
pnpm install
pnpm tauri build --bundles app
```

The app bundle is created at `src-tauri/target/release/bundle/macos/PingZilla Next.app`. See [CONTRIBUTING.md](CONTRIBUTING.md) for development, validation, local signing, and installation workflows.

## Getting started

1. Launch PingZilla Next and find its latency indicator in the menu bar.
2. Click the indicator and choose **Open Dashboard…** to see recent history and settings.
3. Keep the default target or add the hosts you want to monitor.
4. Adjust the ping interval, alert threshold, display mode, site monitors, VPN checks, and launch-at-login setting as needed.
5. Run a network quality test from the dashboard when you want macOS download, upload, and responsiveness diagnostics.

PingZilla Next is a connectivity aid, not an uptime service or a security control. Site checks run only while the app is active, and VPN-change notifications cannot guarantee that traffic was protected.

## Data and network access

PingZilla Next does not require an account. Monitoring history and settings are stored locally in `~/Library/Application Support/pingzilla/history_v2.json`, and time-series history is limited to the most recent 24 hours when loaded.

Depending on the features you enable or use, the app makes these network requests:

- ICMP echo requests to the targets you configure
- Direct HTTP or HTTPS requests to the sites you configure for availability checks
- A public-IP lookup through `ip-api.com` for IP, country, city, and ISP information used by network-session and VPN-change features
- A local invocation of `/usr/bin/networkQuality` when you explicitly start a network quality test; that Apple tool performs its own network measurements

The current `ip-api.com` integration uses unencrypted HTTP. Public-IP lookup metadata can therefore be visible to the network and to that third-party service. This is a known limitation of the current implementation.

## Development and project documents

- [Contributing](CONTRIBUTING.md) — local development, validation, versioning, and production-bundle testing
- [Changelog](CHANGELOG.md) — user-visible changes by release
- [Identity migration plan](docs/identity-migration.md) — planned separation of bundle, signing, autostart, and storage identity
- [Marketing plan](MarketingPlan.md) — early positioning and launch notes

The application uses React 19 and TypeScript for the interface, Rust for monitoring and persistence, and Tauri 2 for the macOS application shell. Run `make help` for the available development and packaging shortcuts.

## License and attribution

PingZilla Next is licensed under the [Apache License 2.0](LICENSE), matching the license included with the upstream work.

PingZilla Next is maintained by [Roman Sheydvasser](https://github.com/rsheyd). It is derived from [PixelTowers/Pingzilla](https://github.com/PixelTowers/Pingzilla), originally created by Chriszilla and Claudio; the upstream repository preserves its contributor history.

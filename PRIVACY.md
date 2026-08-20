# Privacy

PingZilla Next is a local macOS network-monitoring app. It does not require an account, include analytics or advertising code, or send monitoring history to a PingZilla Next-operated service in the current implementation.

## Data stored on your Mac

PingZilla Next stores monitoring history and settings in `~/Library/Application Support/pingzilla/history_v2.json`. This file can include configured targets, site-monitor URLs, public IP and ISP-derived network sessions, locally observed Wi-Fi BSSIDs, custom network names, VPN-monitoring settings, notification settings, and recent macOS network quality results. Time-series history is limited to the most recent 24 hours when the file is loaded.

The app also writes lifecycle diagnostics to `~/Library/Logs/PingZilla Next/`. These logs record application starts, versions, process identifiers, clean exits, and detection of a previously unclean exit; they are not intended to contain targets, monitored URLs, public IP addresses, or monitoring history.

To remove this local data, quit PingZilla Next and delete those files or directories. The current release shares its application-data namespace with upstream PingZilla, so deleting the `pingzilla` directory may also remove data used by an upstream installation. Back up the directory first if both editions have been used.

## Network requests

The app makes network requests during normal monitoring and when you use optional diagnostics:

- ICMP echo requests are sent to monitoring targets you configure.
- HTTP or HTTPS requests are sent directly to site-monitor URLs you configure. Those destination services can observe ordinary connection information such as your public IP address.
- Public IP, country, city, and ISP information is requested from `ip-api.com` for network-session tracking and optional VPN-change features. The current integration uses unencrypted HTTP, so the lookup and response can be visible to the network and to that third party. Replacing this integration with an encrypted design is a tracked pre-distribution task.
- When you explicitly start a network quality test, PingZilla Next runs Apple's `/usr/bin/networkQuality` tool. That system tool performs network measurements against services selected by Apple and returns the results to the app for local display and storage.

Third-party services process requests under their own terms and privacy practices. PingZilla Next does not control those services.

## macOS features

If enabled, PingZilla Next uses macOS notifications for latency, site, or network-change alerts and a macOS LaunchAgent for launch at login. These settings are managed through macOS and the app.

When you choose **Show BSSID**, PingZilla Next requests Location Services access because macOS protects Wi-Fi network identifiers behind that permission. The app reads the BSSID of the access point your Mac is using and stores it with the local network session; it does not request geographic coordinates or transmit the BSSID.

## Scope and updates

This document describes the current source implementation. Review it again before each distributed release, especially when changing network providers, storage, analytics, crash reporting, update services, signing identity, or distribution channel.

Questions or suspected discrepancies can be reported through the repository's [GitHub issues](https://github.com/rsheyd/pingzilla-next/issues).

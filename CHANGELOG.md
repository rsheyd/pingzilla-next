# Changelog

Notable changes to PingZilla Next are documented here.

## [1.4.2] - 2026-08-13

### Added

- Record app starts, explicit quits, panics, clean exits, and previously unclean runs in a small lifecycle log for diagnosing silent exits.
- Add a one-command workflow for building, signing, installing, launching, and verifying the local macOS app.

### Fixed

- Fetch the public IP address on the first background-service tick and refresh its menu-bar row as soon as the lookup completes.

## [1.4.1] - 2026-08-05

### Added

- Add network-aware ping history, network sessions, aliases, and manual speed-test context.
- Add horizontal browsing for longer history ranges in the ping graph.

### Changed

- Rename this edition to PingZilla Next.
- Keep the menu bar app out of the Dock and document local development, versioning, and release-style testing.
- Preserve native tray menu items while live monitoring data updates their labels.

### Fixed

- Keep slow site and public-IP requests from blocking the main ping loop.
- Add connection and request timeouts to public-IP lookups.

## [1.3.11] - 2026-01-24

### Fixed

- Stop polling while macOS is asleep, eliminating the associated background CPU and battery usage.
- Allow macOS to manage App Nap normally.

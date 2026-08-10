# Changelog

Notable changes to PingZilla Next are documented here.

## [1.4.1-dev.3] - 2026-08-10

### Fixed

- Fetch the public IP address on the first background-service tick instead of waiting for a later periodic check.
- Refresh the menu bar IP row as soon as the lookup completes instead of waiting for the next ping tick.

## [1.4.1-dev.2] - 2026-08-05

### Fixed

- Keep slow site and public-IP requests from blocking the main ping loop.
- Add connection and request timeouts to public-IP lookups.

## [1.4.1-dev.1] - 2026-07-31

### Added

- Add network-aware ping history, network sessions, aliases, and manual speed-test context.
- Add horizontal browsing for longer history ranges in the ping graph.

### Changed

- Rename this edition to PingZilla Next.
- Keep the menu bar app out of the Dock and document local development, versioning, and release-style testing.
- Preserve native tray menu items while live monitoring data updates their labels.

## [1.3.11] - 2026-01-24

### Fixed

- Stop polling while macOS is asleep, eliminating the associated background CPU and battery usage.
- Allow macOS to manage App Nap normally.

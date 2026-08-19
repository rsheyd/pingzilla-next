# PingZilla Next identity migration plan

Status: design only; no identity or storage changes have been implemented.

## Purpose

Give PingZilla Next an identity controlled by its maintainer without losing existing user data or interfering with installations of the upstream PingZilla app. This must ship as a deliberate user-visible release, not as part of a documentation-only cleanup.

## Current state

PingZilla Next already has its own product name and repository, but it still inherits identifiers and paths from upstream:

| Concern | Current value or behavior |
|---------|---------------------------|
| Product name | `PingZilla Next` |
| Repository and releases | `rsheyd/pingzilla-next` |
| Bundle identifier | `pingzilla.pixeltowers.io` |
| Entitlement application identifier | `Y5223T2D8X.pingzilla.pixeltowers.io` |
| Local data | `~/Library/Application Support/pingzilla/history_v2.json` |
| Legacy data fallback | `~/Library/Application Support/pingzilla/history.json` |
| Lifecycle diagnostics | `~/Library/Logs/PingZilla Next/lifecycle.log` and `running` |
| Launch at login | Tauri autostart plugin using a macOS LaunchAgent derived from the application identity |

The persisted `history_v2.json` contains ping history, targets, the primary target, notification threshold, site monitors, VPN settings, ping interval, network sessions, network aliases, recent network quality results, and network quality duration. Both upstream PingZilla and PingZilla Next can currently address the inherited namespace, so they must not run concurrently.

## Proposed independent identity

Confirm these values before implementation:

- Product name: `PingZilla Next`
- Bundle identifier: `io.github.rsheyd.pingzilla-next`
- Entitlement application identifier: the maintainer's Apple Team ID followed by `.io.github.rsheyd.pingzilla-next`; do not retain or hard-code the upstream Team ID
- Data directory: `~/Library/Application Support/io.github.rsheyd.pingzilla-next/`
- Primary data file: `history_v2.json` initially, with any later schema rename handled separately
- Lifecycle log directory: `~/Library/Logs/PingZilla Next/` may remain because it is already independently named
- Release and update channel: GitHub releases under `rsheyd/pingzilla-next`, or another channel explicitly controlled by the maintainer

Before choosing a final identifier, confirm that it is accepted by the Apple Developer account and is appropriate for any intended direct-download, notarized, or Mac App Store distribution. The identifier should then be treated as permanent.

## Migration behavior

The first launch under the new identity should use a copy-and-validate migration:

1. Resolve the new data directory and use it exclusively for all future reads and writes.
2. If a valid destination data file already exists, load it and do not overwrite or merge it automatically.
3. If no destination exists, look for the inherited `pingzilla/history_v2.json` file.
4. Read and deserialize the inherited file before creating the destination. If validation fails, leave the source untouched, start with defaults, and present a clear recovery message or log entry.
5. Copy the validated data to a temporary file inside the destination directory, flush it, and atomically rename it to the destination filename.
6. Reload the destination through the normal application loader before marking migration complete.
7. Record a small migration marker containing only the migration version and source path category, not a copy of user data.
8. Never delete, rename, truncate, or modify the inherited source. It may still belong to an installed upstream app and provides a rollback path.
9. Continue supporting the older `pingzilla/history.json` schema only through the existing in-memory conversion, then write the converted result to the new destination. Do not modify the old file.

The application should not continuously fall back to the inherited namespace after a successful migration. Otherwise new installations could silently re-import stale data after a reset.

## Existing destination and conflict policy

Automatic merging is not recommended for the first migration release because session history, aliases, targets, and settings have different conflict semantics. Use these rules:

- Destination exists and is valid: use it.
- Destination exists but is invalid: preserve it, report recovery guidance, and do not overwrite it automatically.
- Destination absent and inherited source is valid: copy and validate the inherited source.
- Destination absent and inherited source is invalid or absent: initialize defaults.

If manual import is later added, it should show the source and destination paths, create backups, and ask whether settings or history should win rather than performing an opaque merge.

## Bundle, signing, and permissions

Changing the bundle identifier creates a distinct macOS application identity. The release work must update and verify:

- `src-tauri/tauri.conf.json` product and bundle metadata
- `src-tauri/Entitlements.plist` application identifier and any distribution-specific entitlements
- Apple Developer App ID, provisioning profile, signing certificates, and notarization or App Store records
- Packaging scripts and Make targets that assume the inherited signing identity
- Any Info.plist values, URL schemes, or future updater configuration tied to the old identifier
- Launch-at-login behavior under the new identity

macOS may treat notification permission, launch-at-login approval, saved window state, and other preferences as belonging to a new app. Release notes and first-run UI should explain that users may need to grant or re-enable them.

## LaunchAgent transition

Do not automatically delete an inherited LaunchAgent because it may belong to the upstream app. On upgrade:

1. Detect whether launch at login is enabled for the new identity.
2. Explain that any old PingZilla or PingZilla Next login item should be disabled before enabling the new one.
3. Register only the new identity's LaunchAgent after explicit user action or a clearly explained migration prompt.
4. Verify after relaunch that only the intended app starts.

A separate, narrowly scoped cleanup command may be offered later if the old registration can be identified unambiguously. It must show the exact item it will remove.

## Implementation phases

### Phase 1: Inventory and freeze decisions

- Confirm the final bundle identifier, Apple Team ID, data directory, distribution channel, and minimum supported migration source.
- Inspect a current signed build for its bundle ID, designated requirement, entitlements, application groups, sandbox container, and LaunchAgent label.
- Capture sample `history.json` and `history_v2.json` fixtures with private values removed.
- Decide whether a migration notice is shown before or after the copy and how recovery errors reach a menu-bar-only user.

### Phase 2: Separate paths from migration logic

- Centralize current and inherited data paths instead of constructing `pingzilla` paths in multiple functions.
- Add an explicit persisted schema or migration version if one is not already present.
- Implement atomic destination writes and useful lifecycle logging without recording public IPs, hostnames, aliases, or monitored URLs.
- Add the one-time copy-and-validate migration and marker.

### Phase 3: Adopt the new application identity

- Update bundle, entitlement, signing, provisioning, packaging, and release configuration together.
- Ensure the new app reads and writes only the new data directory after migration.
- Verify notification and launch-at-login behavior with the new identity.
- Confirm the new app and upstream PingZilla can be installed and run independently after migration.

### Phase 4: Release and support

- Increment all coordinated manifests with `./scripts/version.sh set <version>` and record the change under that exact version in `CHANGELOG.md`.
- Publish release notes that explain the new identity, one-time data copy, preserved legacy data, permission prompts, coexistence, and rollback.
- Back up the inherited and destination data files before the first manual release-candidate test.
- Keep the previous PingZilla Next release available during the migration support window.

## Validation matrix

Test at least these states on both Apple silicon and Intel if the release remains universal:

| Starting state | Expected result |
|----------------|-----------------|
| No inherited or destination data | New destination is initialized with defaults |
| Valid inherited `history_v2.json`, no destination | All persisted fields are copied and load correctly |
| Valid inherited `history.json`, no destination | Legacy history is converted and written only to the new destination |
| Corrupt inherited file, no destination | Source is preserved; app starts safely and reports recovery guidance |
| Valid destination plus inherited data | Destination wins; inherited data is not re-imported |
| Corrupt destination plus valid inherited data | Neither file is overwritten; recovery guidance is shown |
| Upstream app remains installed | Each app uses its own data and can run without modifying the other's state |
| Old launch-at-login item enabled | No ambiguous item is silently deleted; user receives transition guidance |
| Notifications previously allowed | New identity requests or explains permission as macOS requires |
| Ad-hoc local build | Migration and rollback work without distribution signing assumptions |
| Signed/notarized or store build | Entitlements, sandbox access, notifications, and launch at login work under the final identity |

For migrated data, compare targets, settings, monitor definitions, aliases, session counts, retained timestamps, and speed-test results before and after. Confirm the inherited files remain byte-for-byte unchanged.

## Rollback

Rollback must not depend on reversing the data copy. Because the inherited files remain untouched, users can quit the new release and relaunch the earlier app against its original namespace. Any activity created only after the new release starts will remain in the new namespace and will not appear in the old app.

Before release, document the exact locations of both data files and provide manual backup instructions. Do not advise users to replace one file with the other unless schema compatibility has been tested for the two exact versions involved.

## Acceptance criteria

The migration is complete only when:

- PingZilla Next is signed and packaged with an identifier controlled by its maintainer.
- All normal persistence uses the new namespace.
- A valid inherited data file is copied once, validated, and never modified.
- Existing destination data is never silently overwritten.
- Upstream PingZilla and PingZilla Next can run concurrently without sharing data or launch-at-login state.
- Notification, sandbox, network access, launch-at-login, clean quit, and lifecycle diagnostics are verified in the distributed build.
- The user-visible release includes a coordinated version bump, changelog entry, migration explanation, backup guidance, and rollback instructions.

## Non-goals

- Renaming the Rust crate or npm package solely for branding
- Deleting upstream data or login items
- Automatically merging two independently modified histories
- Changing the persisted data schema beyond what is necessary to record migration state
- Introducing an account, cloud sync, analytics, or an updater as part of the identity change

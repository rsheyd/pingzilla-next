# Contributing to PingZilla Next

- [Contributing to PingZilla Next](#contributing-to-pingzilla-next)
  - [Testing Changes on Your Mac](#testing-changes-on-your-mac)
  - [Which workflow should I use?](#which-workflow-should-i-use)
  - [Fast development workflow](#fast-development-workflow)
  - [Validation without launching the app](#validation-without-launching-the-app)
  - [Versioning](#versioning)
  - [Testing a local production bundle](#testing-a-local-production-bundle)
    - [Combined command](#combined-command)
    - [Detailed steps](#detailed-steps)

## Testing Changes on Your Mac

You do not need to uninstall the Mac App Store or `/Applications` copy of the original PingZilla. Quit it before launching a development or local build so that two related processes do not monitor and write the shared history at the same time.

## Which workflow should I use?

| Goal | Command | Creates a `.app` bundle? |
|------|---------|---------------------------|
| Interactively test UI or Rust/backend behavior | `pnpm tauri dev` | No |
| Reproduce installed-app behavior or test packaging, signing, sandboxing, entitlements, or a release candidate | `pnpm tauri build --bundles app` | Yes |

For example, `pnpm tauri dev` is sufficient to test both the network-name pencil interaction and whether **Quit PingZilla Next** exits cleanly. Since a Quit crash can depend on the native packaged runtime, also test a production bundle once before considering that fix release-ready. You do not need to rebuild the bundle after every small UI iteration.

## Fast development workflow

Use this for normal frontend and backend development:

```bash
pnpm install
pnpm tauri dev
```

PingZilla Next starts as a menu-bar app and may not open a window automatically. Click its menu-bar icon and choose **Open Dashboard…**.

Changes made while `pnpm tauri dev` is running rebuild automatically. When finished:

1. Stop the development process with `Control-C` in Terminal.
2. Quit the development PingZilla Next instance if it remains open.
3. Relaunch the installed version from `/Applications` if desired.

## Validation without launching the app

For a small UI-only change:

```bash
pnpm build
```

This checks TypeScript and creates the Vite frontend build. It does not create or update a macOS app bundle.

For Rust/backend changes:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
```

## Versioning

PingZilla Next uses one coordinated version across `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`. Do not edit these values independently. Set the version from the repository root with:

```bash
./scripts/version.sh set 1.4.3
```

The equivalent Make target is `make version VERSION=1.4.3`. Verify the files at any time with `./scripts/version.sh check` or `make version-check`.

Use semantic versioning for release versions:

- Increase the patch number for compatible fixes and small improvements, for example `1.3.11` to `1.3.12`.
- Increase the minor number for a meaningful set of new, compatible features, for example `1.3.11` to `1.4.0`.
- Reserve a major-version increase for a release with substantial incompatible behavior or expectations.

Do not increase the version for ordinary `pnpm tauri dev`, `pnpm build`, or `cargo test` runs. When creating a local production bundle whose identity matters—especially while following the steps below to test packaging, sandboxing, or several release candidates—use the version script with a prerelease version based on the next intended release, such as `./scripts/version.sh set 1.4.3-dev.1`. Increase the final number for another distinguishable build (`dev.2`, `dev.3`, and so on). This prevents an unreleased test bundle from presenting itself as the already-published stable release.

Dev-style versions are for local testing only and must not be submitted to the Mac App Store. Before making a release candidate or distribution build, replace the prerelease version with the final numeric release version and verify the generated app reports it correctly.

## Testing a local production bundle

### Combined command

Build, ad-hoc sign, install in `/Applications`, launch, and verify the app with:

```bash
./scripts/build-install-macos.sh
```

The script skips DMG creation and replaces the installed bundle without retaining a backup. It stops rather than force-killing the app if PingZilla Next does not quit cleanly.

### Detailed steps

Create a production-style app when testing native runtime, sandbox, entitlement, packaging, installed-app behavior, or release behavior. This is a separate copy for release-like local testing; it is not needed just to make `pnpm tauri dev` pick up current source changes. If the bundle needs to be distinguishable from the current release or from earlier test bundles, assign it the next `-dev.N` version described above before building.

```bash
pnpm tauri build --bundles app
```

The app is created at:

```text
src-tauri/target/release/bundle/macos/PingZilla Next.app
```

For local sandbox testing, apply an ad-hoc signature with PingZilla Next's entitlements:

```bash
codesign --force --deep --sign - \
  --entitlements src-tauri/Entitlements.plist \
  "src-tauri/target/release/bundle/macos/PingZilla Next.app"
```

Quit any running copy of PingZilla or PingZilla Next before testing the bundle so that two processes do not monitor and write history at the same time. To launch the bundle in place:

```bash
open "src-tauri/target/release/bundle/macos/PingZilla Next.app"
```

To install the local build in `/Applications`, sign it first using the command above. If an older copy is already installed, remove or replace that entire app bundle rather than merging files into it. Then copy and launch the new bundle:

```bash
rm -rf "/Applications/PingZilla Next.app"
cp -R "src-tauri/target/release/bundle/macos/PingZilla Next.app" /Applications/
open "/Applications/PingZilla Next.app"
```

Signing before copying preserves the completed bundle's signature; modifying files inside the app afterward invalidates it.

This ad-hoc signature is for local testing only; it is not a distribution or Mac App Store signature.

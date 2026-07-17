# Contributing to PingZilla

- [Contributing to PingZilla](#contributing-to-pingzilla)
  - [Testing Changes on Your Mac](#testing-changes-on-your-mac)
  - [Which workflow should I use?](#which-workflow-should-i-use)
  - [Fast development workflow](#fast-development-workflow)
  - [Validation without launching the app](#validation-without-launching-the-app)
  - [Testing a local production bundle](#testing-a-local-production-bundle)

## Testing Changes on Your Mac

You do not need to uninstall the Mac App Store or `/Applications` copy of PingZilla. Quit it before launching a development or local build so that two PingZilla processes do not monitor and write history at the same time.

## Which workflow should I use?

| Goal | Command | Creates a `.app` bundle? |
|------|---------|---------------------------|
| Interactively test UI or Rust/backend behavior | `pnpm tauri dev` | No |
| Reproduce installed-app behavior or test packaging, signing, sandboxing, entitlements, or a release candidate | `pnpm tauri build --bundles app` | Yes |

For example, `pnpm tauri dev` is sufficient to test both the network-name pencil interaction and whether **Quit PingZilla** exits cleanly. Since a Quit crash can depend on the native packaged runtime, also test a production bundle once before considering that fix release-ready. You do not need to rebuild the bundle after every small UI iteration.

## Fast development workflow

Use this for normal frontend and backend development:

```bash
pnpm install
pnpm tauri dev
```

PingZilla starts as a menu-bar app and may not open a window automatically. Click its menu-bar icon and choose **Open Dashboard…**.

Changes made while `pnpm tauri dev` is running rebuild automatically. When finished:

1. Stop the development process with `Control-C` in Terminal.
2. Quit the development PingZilla instance if it remains open.
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

## Testing a local production bundle

Create a production-style app when testing native runtime, sandbox, entitlement, packaging, installed-app behavior, or release behavior. This is a separate copy for release-like local testing; it is not needed just to make `pnpm tauri dev` pick up current source changes.

```bash
pnpm tauri build --bundles app
```

The app is created at:

```text
src-tauri/target/release/bundle/macos/PingZilla.app
```

For local sandbox testing, apply an ad-hoc signature with PingZilla's entitlements:

```bash
codesign --force --deep --sign - \
  --entitlements src-tauri/Entitlements.plist \
  src-tauri/target/release/bundle/macos/PingZilla.app
```

Quit any running copy of PingZilla before testing the bundle so that two processes do not monitor and write history at the same time. To launch the bundle in place:

```bash
open src-tauri/target/release/bundle/macos/PingZilla.app
```

To install the local build in `/Applications`, sign it first using the command above. If an older copy is already installed, remove or replace that entire app bundle rather than merging files into it. Then copy and launch the new bundle:

```bash
rm -rf /Applications/PingZilla.app
cp -R src-tauri/target/release/bundle/macos/PingZilla.app /Applications/
open /Applications/PingZilla.app
```

Signing before copying preserves the completed bundle's signature; modifying files inside the app afterward invalidates it.

This ad-hoc signature is for local testing only; it is not a distribution or Mac App Store signature.

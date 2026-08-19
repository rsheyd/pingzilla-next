# PingZilla Next TODO

This list tracks work that is still relevant to the independently maintained PingZilla Next edition. Release-specific identity work is detailed in [docs/identity-migration.md](docs/identity-migration.md).

## Before broader distribution

- [ ] Replace the unencrypted `http://ip-api.com/json/` public-IP lookup with an HTTPS-capable provider or another encrypted design, then update the privacy documentation and tests.
- [ ] Choose and verify the permanent bundle identifier, Apple Team ID, signing configuration, and distribution channel.
- [ ] Implement and validate the copy-only storage migration described in `docs/identity-migration.md`.
- [ ] Confirm that upstream PingZilla and PingZilla Next can run concurrently without sharing storage or launch-at-login state.
- [ ] Prepare release notes, backup guidance, rollback instructions, and refreshed screenshots for the identity release.
- [ ] Decide whether the first independent release will use GitHub Releases, notarized direct download, the Mac App Store, or a staged combination.

## Distribution preparation

- [ ] Create the final Apple Developer App ID and matching provisioning profile only after the permanent bundle identifier is chosen.
- [ ] Verify direct-download signing and notarization or complete the appropriate App Store Connect setup.
- [ ] Review `PRIVACY.md` against the release candidate and any store disclosure requirements.
- [ ] Test the packaged release on supported macOS versions and both architectures if universal builds remain supported.
- [ ] Publish checksums and installation instructions with the release artifacts.

## Possible future features

- [ ] Export history to CSV or JSON.
- [ ] Add on-demand traceroute diagnostics.
- [ ] Add configurable notification sounds.
- [ ] Evaluate a menu bar widget or companion experience only after the core macOS release is stable.

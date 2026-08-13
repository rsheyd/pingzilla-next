#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
BUILT_APP="$PROJECT_DIR/src-tauri/target/release/bundle/macos/PingZilla Next.app"
INSTALLED_APP="/Applications/PingZilla Next.app"
ENTITLEMENTS="$PROJECT_DIR/src-tauri/Entitlements.plist"

cd "$PROJECT_DIR"

pnpm tauri build --bundles app

if [[ ! -d "$BUILT_APP" ]]; then
  print -u2 "Built app not found: $BUILT_APP"
  exit 1
fi

codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" "$BUILT_APP"
codesign --verify --deep --strict --verbose=2 "$BUILT_APP"

osascript -e 'tell application "PingZilla Next" to quit' 2>/dev/null || true
for _ in {1..20}; do
  pgrep -x pingzilla >/dev/null || break
  sleep 0.25
done
if pgrep -x pingzilla >/dev/null; then
  print -u2 "PingZilla Next did not quit; installation stopped."
  exit 1
fi

rm -rf "$INSTALLED_APP"
cp -R "$BUILT_APP" "$INSTALLED_APP"

codesign --verify --deep --strict --verbose=2 "$INSTALLED_APP"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INSTALLED_APP/Contents/Info.plist")
open "$INSTALLED_APP"

for _ in {1..20}; do
  pgrep -x pingzilla >/dev/null && break
  sleep 0.25
done
if ! pgrep -x pingzilla >/dev/null; then
  print -u2 "PingZilla Next $VERSION was installed but did not launch."
  exit 1
fi

print "Installed and launched PingZilla Next $VERSION."

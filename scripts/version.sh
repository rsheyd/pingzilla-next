#!/bin/bash

set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repository_root"

usage() {
  echo "Usage: scripts/version.sh check | scripts/version.sh set VERSION" >&2
  exit 2
}

command_name="${1:-}"
case "$command_name" in
  check)
    [ "$#" -eq 1 ] || usage
    ;;
  set)
    [ "$#" -eq 2 ] || usage
    ;;
  *)
    usage
    ;;
esac

node - "$command_name" "${2:-}" <<'NODE'
import fs from "node:fs";

const [commandName, requestedVersion] = process.argv.slice(2);
const packagePath = "package.json";
const cargoPath = "src-tauri/Cargo.toml";
const cargoLockPath = "src-tauri/Cargo.lock";
const tauriPath = "src-tauri/tauri.conf.json";
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function packageVersion() {
  return JSON.parse(fs.readFileSync(packagePath, "utf8")).version;
}

function tauriVersion() {
  return JSON.parse(fs.readFileSync(tauriPath, "utf8")).version;
}

function cargoVersion(content = fs.readFileSync(cargoPath, "utf8")) {
  let insidePackage = false;
  for (const line of content.split("\n")) {
    if (line === "[package]") {
      insidePackage = true;
      continue;
    }
    if (insidePackage && line.startsWith("[")) break;
    const version = insidePackage ? line.match(/^version = "([^"]+)"$/)?.[1] : undefined;
    if (version) return version;
  }
  throw new Error(`Could not read the package version from ${cargoPath}.`);
}

function cargoLockVersion(content = fs.readFileSync(cargoLockPath, "utf8")) {
  const packageBlock = content.match(/\[\[package\]\]\nname = "pingzilla"\nversion = "([^"]+)"/);
  if (!packageBlock) throw new Error(`Could not find the pingzilla package in ${cargoLockPath}.`);
  return packageBlock[1];
}

function writeJson(filePath, value) {
  const temporaryPath = `${filePath}.version-tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function replaceCargoVersion(content, version) {
  let insidePackage = false;
  let replaced = false;
  const updated = content.split("\n").map((line) => {
    if (line === "[package]") {
      insidePackage = true;
      return line;
    }
    if (insidePackage && line.startsWith("[")) insidePackage = false;
    if (insidePackage && /^version = "[^"]+"$/.test(line)) {
      replaced = true;
      return `version = "${version}"`;
    }
    return line;
  }).join("\n");
  if (!replaced) throw new Error(`Could not update the package version in ${cargoPath}.`);
  return updated;
}

function replaceCargoLockVersion(content, version) {
  const pattern = /(\[\[package\]\]\nname = "pingzilla"\nversion = ")[^"]+("\n)/;
  if (!pattern.test(content)) throw new Error(`Could not update the pingzilla package in ${cargoLockPath}.`);
  return content.replace(pattern, `$1${version}$2`);
}

function checkVersions() {
  const versions = {
    [packagePath]: packageVersion(),
    [cargoPath]: cargoVersion(),
    [tauriPath]: tauriVersion(),
    [cargoLockPath]: cargoLockVersion(),
  };
  const uniqueVersions = new Set(Object.values(versions));
  if (uniqueVersions.size !== 1) {
    for (const [filePath, version] of Object.entries(versions)) console.error(`${filePath}: ${version}`);
    throw new Error("PingZilla Next versions do not match.");
  }
  const [version] = uniqueVersions;
  if (!semverPattern.test(version)) throw new Error(`The synchronized version is not valid SemVer: ${version}`);
  console.log(`PingZilla Next version ${version} is synchronized.`);
}

if (commandName === "set") {
  if (!semverPattern.test(requestedVersion)) throw new Error(`Invalid semantic version: ${requestedVersion}`);

  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = requestedVersion;
  writeJson(packagePath, packageJson);

  const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
  tauriConfig.version = requestedVersion;
  writeJson(tauriPath, tauriConfig);

  const cargoToml = fs.readFileSync(cargoPath, "utf8");
  fs.writeFileSync(cargoPath, replaceCargoVersion(cargoToml, requestedVersion));

  const cargoLock = fs.readFileSync(cargoLockPath, "utf8");
  fs.writeFileSync(cargoLockPath, replaceCargoLockVersion(cargoLock, requestedVersion));
}

checkVersions();
NODE

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.2] - 2026-05-07

### Build / release

- GitHub publishing uses `releaseType: "release"` so artifacts attach to published releases (not draft-only workflow).
- Windows `dist-win.mjs` reads `GH_TOKEN` / `GITHUB_TOKEN` from User or Machine environment when the IDE shell was started before tokens were set.
- Release notes continue to come from `CHANGELOG.md` via `releaseInfo.releaseNotesFile`.

## [2.1.1] - 2026-05-07

### Added

- ESLint and Vitest with baseline smoke and sensor-parser tests (`npm run lint`, `npm run test`).
- IPC handler to cancel gateway scans from the UI.
- Windows packaging helper (`npm run dist:win`) that clears signing env quirks and runs electron-builder reliably without needing the `.cmd` shim under Node.

### Changed

- Connection pool: normalized gateway IPs, tracked reconnect timers, and tightened emits when connections are removed or addresses are invalid.
- Active gateway polling waits until a gateway has an IP; MODBUS register reads validate the target IP.
- Client preload/socket bridge forwards multi-argument IPC correctly for compatibility with existing handlers.
- LoRaWAN UDP handling: removed unreachable code after control-flow breaks.

### Fixed

- Duplicate `autoUpdateEnabled` handling and gateway-timeout behaviour that could interrupt polling.
- Safer error logging in the preload script.

### Build / release

- Windows NSIS builds avoid downloading `winCodeSign` when executable signing/rcedit is disabled (`signAndEditExecutable: false`), so installers can be produced without Administrator/Developer Mode symlink privileges. Unsigned builds may show generic executable metadata compared to fully signed builds.
- `DOCs` folder included in packaged extra resources (with `.gitkeep` for empty checkout).

## [2.1.0] and earlier

See internal release notes or repository history for prior versions.

[2.1.2]: https://github.com/monnit-support/monnit-modbus-tcp-utility/compare/v2.1.1...v2.1.2

[2.1.1]: https://github.com/monnit-support/monnit-modbus-tcp-utility/compare/v2.1.0...v2.1.1

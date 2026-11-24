# Project passport

| Field | Value |
|---|---|
| Product | Nocturne Notes |
| Stable version | 2.0.0 |
| Platform | Windows 11 x64 |
| Runtime | Electron 45.4.1, Node.js built-in SQLite |
| Packaging | electron-builder 26.18.0; NSIS and Portable |
| Package / App ID | nocturne-notes / com.nocturnenotes.desktop |
| Interface | English (default), Russian |
| Project | .ns, local SQLite |
| License | MIT (as declared in package.json) |

## Purpose and scope
A compact, quiet, dark-glass workspace for personal writing, research and organized notes. One project contains multiple richly formatted notes. No accounts or cloud service are required. The release includes creation, duplication, ordering, trash, rich text, scoped search/replace, exports, recovery, adjustable typography, session undo/redo, focus mode, always-on-top and optional notification-area operation.

## Release baseline
Both editions were manually accepted by the owner. The final source passed 40 unit tests, actual Electron desktop tests, performance comparison against 1.8, PE icon verification, installer/shortcut/association tests and uninstall preservation. The original accepted source is identified by commit 924b6ad422fd6f7601eeff7c3f24b117dae8887b in the development repository; the public snapshot preserves application source and artwork.

## Explicit exclusions
No cloud sync, account system, encryption, automatic startup, note pinning, checklists, persistent version history, Time Machine or Smart Typography. Do not add them without a new scope decision. No automatic migration of experimental profiles.

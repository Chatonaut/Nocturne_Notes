<p align="center"><img src="assets/nocturne-brand-mark.png" width="116" alt="Nocturne Notes logo"></p>

<h1 align="center">Nocturne Notes</h1>
<p align="center"><strong>Minimalist note editor</strong></p>
<p align="center">Your notes. Your files. Your workspace.</p>
<p align="center">Windows 11 x64 · 2.5.0 · Open source</p>

<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/Chatonaut/Nocturne_Notes?label=release"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml"><img alt="Windows build" src="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases"><img alt="downloads" src="https://img.shields.io/github/downloads/Chatonaut/Nocturne_Notes/total"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/Chatonaut/Nocturne_Notes?style=flat"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/github/license/Chatonaut/Nocturne_Notes"></a>
</p>

<p align="center">
  <a href="docs/en/01_PASSPORT.md"><img alt="Windows 11 x64" src="https://img.shields.io/badge/Windows-11%20x64-336699"></a>
  <a href="docs/en/04_ARCHITECTURE.md"><img alt="Electron" src="https://img.shields.io/badge/Electron-45.5.0-536878"></a>
  <a href="docs/en/05_NS_FORMAT.md"><img alt="SQLCipher" src="https://img.shields.io/badge/SQLCipher-4.20.0-536878"></a>
  <a href="docs/en/04_ARCHITECTURE.md"><img alt="OpenSSL" src="https://img.shields.io/badge/OpenSSL-3.6.5-536878"></a>
  <a href="docs/en/05_NS_FORMAT.md"><img alt="Local files" src="https://img.shields.io/badge/Storage-local%20.ns-536878"></a>
  <a href="docs/en/USER_GUIDE.md"><img alt="Languages" src="https://img.shields.io/badge/Languages-EN%20%7C%20RU-536878"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.ru.md">Русский</a></p>
<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><strong>Download</strong></a> ·
  <a href="docs/en/USER_GUIDE.md">User guide</a> ·
  <a href="docs/en/CHANGELOG.md">What's new</a> ·
  <a href="docs/en/00_START_HERE.md">Documentation</a>
</p>

---

## Download

[Latest release](https://github.com/Chatonaut/Nocturne_Notes/releases/latest) · [All releases](https://github.com/Chatonaut/Nocturne_Notes/releases)

| Edition | Setup | Portable |
|---|---|---|
| File | [Nocturne Notes Setup.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Setup.exe) | [Nocturne Notes Portable.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Portable.exe) |
| Installation | Per-user, choose directory | None |
| Windows integration | Shortcuts and .ns association | Run the EXE directly |
| Profile | %APPDATA%/Nocturne Notes | %APPDATA%/Nocturne Notes Portable |
| Projects & features | Same application | Same application |

Verify [SHA256SUMS.txt](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/SHA256SUMS.txt) for the corresponding release. GitHub may replace spaces in download names with dots; compare the SHA-256 values or rename the downloaded files to match the manifest. Unsigned EXEs may show Windows SmartScreen; checksums verify integrity, not publisher identity. Portable keeps a separate local profile, not a fully self-contained profile.

## What's new in 2.5

| Feature | What's changed |
|---|---|
| Project protection | SQLCipher; set, change and remove a password |
| Quick lock | One lock for three states; Ctrl+Shift+L |
| Drafts | Save, discard or cancel on exit and project changes |
| Pinned notes | A dedicated group at the top of the list |
| Reliability | Atomic operations, verified copies, file-identity recovery |
| Search & interface | Live results, compact match offsets, persistent sidebar state |

[Full changelog →](docs/en/CHANGELOG.md)

## A workspace, not a service

- Rich text, seven system fonts, adjustable title/body sizes and line spacing, bounded session undo/redo.
- One local .ns database with multiple notes, trash and pin metadata; search and replace in a note or throughout the project.
- Optional SQLCipher protection, manual lock/unlock, quick Ctrl+Shift+L; no account or cloud service required.
- Temporary projects with Save/Don't save/Cancel, independent recovery, pinned notes, focus mode, always on top, optional tray.
- TXT, HTML and Markdown exports. English by default; complete Russian application localization.

## A closer look

![Actual editor, synthetic project](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Editor.png)

| Settings | Project protection |
|---|---|
| ![Actual settings](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Settings.png) | ![Actual password setup](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Protection.png) |

[Locked project](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Locked.png) · [Social preview](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Social-Preview.png). Screenshots captured from the real Electron application with synthetic notes, not mockups; 2.5.0 download and image links become available after successful release publication.

## Under the hood

HTML/CSS/JavaScript in Electron, isolated renderer/preload, Node main, SQLite for plain projects and SQLCipher 4.20.0 Community with static OpenSSL 3.6.5 for protected projects. No extra UI framework. Native window readiness and eight resize zones. Current .ns marker: nocturne-notes-v1. Pinned dependencies, validated IPC, CSP, packaged ASAR integrity and hardened fuses.

The final validation of the approved source included 86 unit tests and 60 workload sessions with up to 1000 notes. All checks passed, but synthetic measurements are not performance guarantees or security certification. The independent build verifies actual EXEs, Portable startup, install/uninstall, native runtime, audits and checksums. [Quality assurance](docs/en/07_QA_ACCEPTANCE.md).

## Nocturne Notes in numbers

| Detail | Value |
|---|---|
| System fonts | 7 |
| Text palette | 35 colors |
| Body text size | 10–35 px |
| Title size | 15–35 px |
| Line height | 1.0–2.0 |
| Autosave | 1–20 minutes; default 1 minute |
| Independent recovery write | After a 450 ms pause in editing |
| Undo history | Up to 50 steps per note; shared approximate 64 MiB budget |
| Maximum note title | 250 characters |
| Maximum note HTML | 5,000,000 characters |
| Minimum window | 740 × 480 |
| Export | TXT · HTML · Markdown |

Limits describe the current format and editor, not guaranteed performance on every computer.

## One lock, three states

| Project state | Lock button or Ctrl+Shift+L |
|---|---|
| Plain | Opens password setup |
| Protected, unlocked | Conceals content, saves pending edits and locks |
| Protected, locked | Prompts for the password |

The password is not stored in preferences. Minimum 8 Unicode code points; use a long unique passphrase. Minimizing or hiding in the tray does not automatically lock the project.

## Inside a project

One .ns file contains notes, their order, pins and trash. Plain projects use SQLite; protected projects use SQLCipher. An open project can have a SQLite rollback journal, so close the app before copying or moving a project. Protected recovery is inside the database; plain recovery is in the local profile.

[Project format](docs/en/05_NS_FORMAT.md) · [Risks and limitations](docs/en/10_RISKS_AND_DECISIONS.md)

## Privacy and FAQ

**Do I need internet?** No account/cloud/sync feature. Default-session tests observed no app HTTP/WebSocket requests; external links and optional spellcheck dictionaries are separate.

**What does password protection cover?** Project contents, including note titles, trash and protected recovery. File names, clipboard, plaintext exports and earlier copies are not protected. No password reset or secure deletion; keep backups.

**Can I move a project?** Close the application and copy the .ns database. Do not edit the same project in two processes.

**Does uninstall erase notes?** The per-user installer preserves projects and preferences. Portable also keeps a separate AppData profile.

## Getting started

1. Download Setup or Portable from the official release.
2. Create a note with + and save the project as an .ns file.
3. Pin an important note and adjust the typography if desired.
4. For confidential notes, set a password and keep a backup of the closed project.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N / Ctrl+Shift+N | New note / project |
| Ctrl+O / Ctrl+S | Open / save |
| Ctrl+Shift+S | Save As |
| Ctrl+F / Ctrl+H | Search / replace |
| Ctrl+Backslash | Sidebar |
| Ctrl+Shift+L | Set password / lock / unlock |
| F11 / Esc | Focus / exit focus |
| Ctrl+Shift+T | Always on top |

[All shortcuts and user guide](docs/en/USER_GUIDE.md) · [What's new](docs/en/CHANGELOG.md) · [Documentation](docs/en/00_START_HERE.md) · [Build from source](docs/en/06_BUILD_GITHUB.md) · [Format and security limits](docs/en/05_NS_FORMAT.md) · [Risks](docs/en/10_RISKS_AND_DECISIONS.md)

## For developers

The source and dependencies are pinned. The public workflow performs an independent Windows build with SQLCipher, OpenSSL, UI, security, packaging and installer checks. Audit reports and SBOMs are generated automatically.

[Build guide](docs/en/06_BUILD_GITHUB.md) · [Architecture](docs/en/04_ARCHITECTURE.md) · [Windows Actions](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml) · [Report an issue](https://github.com/Chatonaut/Nocturne_Notes/issues)

Do not attach real projects, notes, passwords or personal data to issue reports.

MIT — see [LICENSE](LICENSE). Third-party notices are bundled with the Windows build. The Windows workflow builds independently from this public snapshot.

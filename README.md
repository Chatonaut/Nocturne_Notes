<p align="center"><img src="assets/nocturne-brand-mark.png" width="100" alt="Nocturne Notes"></p>

<h1 align="center">Nocturne Notes</h1>
<p align="center"><strong>Minimalist note editor</strong> · Windows 11 x64 · 2.5.0</p>
<p align="center">A quiet place for notes, ideas and focused writing.</p>

English · [Русский](README.ru.md)

[![Release](https://img.shields.io/github/v/release/Chatonaut/Nocturne_Notes?label=Release)](https://github.com/Chatonaut/Nocturne_Notes/releases/latest) [![Windows CI](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg)](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml) [![Downloads](https://img.shields.io/github/downloads/Chatonaut/Nocturne_Notes/total)](https://github.com/Chatonaut/Nocturne_Notes/releases) [![MIT](https://img.shields.io/github/license/Chatonaut/Nocturne_Notes)](LICENSE) ![Windows](https://img.shields.io/badge/Windows-11%20x64-336699) ![Electron](https://img.shields.io/badge/Electron-45.5.0-536878) ![SQLCipher](https://img.shields.io/badge/SQLCipher-4.20.0-536878) ![Offline](https://img.shields.io/badge/Offline-local-536878)

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

Interesting details: a 450 ms independent recovery delay; 1–20 minute autosave; 50 logical undo steps per note and shared approximate 64 MiB history budget; minimum window 740×480; 35-color palette; compact search offsets and capped highlights without limiting match navigation. The final source validation passed 86 unit tests and 60 workload sessions with up to 1000 notes; synthetic CI results are not performance guarantees or security certification. See [QA](docs/en/07_QA_ACCEPTANCE.md).

## Privacy and FAQ

**Do I need internet?** No account/cloud/sync feature. Default-session tests observed no app HTTP/WebSocket requests; external links and optional spellcheck dictionaries are separate.

**What does password protection cover?** Project contents, including note titles, trash and protected recovery. File names, clipboard, plaintext exports and earlier copies are not protected. No password reset or secure deletion; keep backups.

**Can I move a project?** Close the application and copy the .ns database. Do not edit the same project in two processes.

**Does uninstall erase notes?** The per-user installer preserves projects and preferences. Portable also keeps a separate AppData profile.

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

MIT — see [LICENSE](LICENSE). Third-party notices are bundled with the Windows build. The Windows workflow builds independently from this public snapshot.

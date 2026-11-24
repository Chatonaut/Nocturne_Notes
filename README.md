<div align="center">
<img src="assets/nocturne-notes-logo.png" width="112" alt="Nocturne Notes logo">

# Nocturne Notes

**A quiet workspace for your thoughts.**

English · [Русский](README.ru.md)

![Version](https://img.shields.io/badge/version-2.0.0-blue) ![Windows](https://img.shields.io/badge/Windows-11%20x64-0078D4) ![Electron](https://img.shields.io/badge/Electron-45.4.1-47848F) ![SQLite](https://img.shields.io/badge/storage-SQLite-003B57) ![Languages](https://img.shields.io/badge/languages-EN%20%7C%20RU-7655A6) ![Offline](https://img.shields.io/badge/privacy-offline-238636) ![License](https://img.shields.io/badge/license-MIT-yellow) [![Windows build](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg)](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml)
</div>

A minimal dark-glass note editor for Windows 11. Write, organize and format your notes in local projects. No account, no cloud service, no subscription.

## Download

| Edition | File |
|---|---|
| Installer | [Nocturne Notes Setup 2.0.0.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/tag/v2.0.0) |
| Portable | [Nocturne Notes Portable.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/tag/v2.0.0) |
| Integrity | [SHA256SUMS.txt](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.0.0/SHA256SUMS.txt) |

[Release notes and all downloads](https://github.com/Chatonaut/Nocturne_Notes/releases/tag/v2.0.0). Windows 11 x64; unsigned executable builds, so Windows may display a publisher warning. Portable requires no installation but keeps a local AppData profile.

## Features

- A compact dark-glass interface, transparent corners and resizable/collapsible sidebar.
- Multiple rich-text notes in each local .ns SQLite project; drag ordering, duplicate, trash and restore.
- Find and replace within a note or across the project; TXT, HTML and Markdown export.
- Autosave, crash recovery, session undo/redo, seven system fonts and adjustable typography.
- Focus mode, always-on-top and optional minimize to tray on close.
- English by default; full Russian application UI.

## Screenshots

<p align="center"><img src="https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.0.0/Nocturne-Notes-Editor.png" width="850" alt="Editor"><br><img src="https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.0.0/Nocturne-Notes-Settings.png" width="850" alt="Settings"></p>

## Documentation

[User guide](docs/en/USER_GUIDE.md) · [Documentation index](docs/en/00_START_HERE.md) · [Changelog](docs/en/CHANGELOG.md) · [Build from source](docs/en/06_BUILD_GITHUB.md) · [NS format](docs/en/05_NS_FORMAT.md)

## Privacy

Notes are stored locally, not encrypted by the app. No account or cloud-sync feature. Back up closed .ns files; do not rely on session Undo as version history.

## Development

Node.js 22, Electron 45.4.1, vanilla JavaScript, built-in SQLite. See the build guide before packaging. Source is released under [MIT](LICENSE).


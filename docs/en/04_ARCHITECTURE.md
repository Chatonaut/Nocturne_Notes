# Architecture

Electron 45.4.1 main process + isolated renderer, vanilla HTML/CSS/JS, SQLite through node:sqlite. No extra UI framework or runtime database dependency. npm ci uses the pinned lockfile; Node 22 is the build/test CLI.

| Module | Responsibility |
|---|---|
| main.js | Window lifecycle, native resize, menus/tray, project and settings IPC, dialogs |
| preload.js | Explicit contextBridge API, native resize pointer capture |
| renderer.js | Editor, DOM, state, history, save/recovery orchestration, settings, localization |
| index.html / styles.css | Frozen interface and styles |
| brand.css / windows-shell.css / features.css | Approved artwork, Windows shell and feature additions |
| storage.js | ProjectStore, SQLite transactions, format validation, trash |
| recovery.js | Atomic per-path recovery snapshots |
| search.js / undo-buffer.js | Text-aware search and session history |
| settings.js / i18n.js | Validated defaults and EN/RU dictionary |
| window-shape.js / corner-resize.js | Native shape and bounds calculation |
| preview-api.js | Browser-only localStorage/JSON demonstration; not .ns desktop storage |
| build/installer.nsh / scripts/ | NSIS override, verification, benchmarks and testing |

Renderer uses contextIsolation, no Node integration, webSecurity enabled; preload provides narrowly scoped IPC. sandbox is disabled for the existing preload implementation, not a security boundary to expand. Validate input in main/storage; avoid arbitrary IPC and external navigation. Only HTTP(S) links are delegated to the OS. No server or account backend.

Settings use app.getPath('userData')/preferences.json; drafts and recovery are separate subdirectories. Installed edition retains existing Electron profile and app ID; Portable uses %APPDATA%/Nocturne Notes Portable and independent taskbar ID, recognized by PORTABLE_EXECUTABLE_FILE. Portable is not a fully self-contained data profile. Startup is hidden until renderer/style readiness. Tray exists only when enabled; close acknowledgment decides hide or quit after flush. Before-quit requests true exit. Avoid changing startup logic or IDs without explicit regression checks.

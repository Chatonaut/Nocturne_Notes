# Changelog
## 2.5.0 — 27 November 2026
- Optional SQLCipher password protection for the full project, including recovery/trash; set, change, remove, lock and unlock. Three-state titlebar lock and Ctrl+Shift+L with immediate privacy mask, retry/cancel on save failure.
- Managed temporary drafts with Save/Don't save/Cancel, recovery of interrupted active draft independent of restore setting, safe cleanup.
- Pinned notes in fixed top group, protected from move/delete, unpinned copies/restores; adaptive context menu.
- Whole-minute autosave 1–20, default 1. Live project search, compact offsets for dense results, capped highlights without limiting navigation, retained DOM rows, safe internal drag, atomic batch replacement and Unicode-aware matching.
- Reliable serialized transitions, verified logical copies, atomic note creation, recovery keyed by file identity, safe hard-link refusal, sidebar rollback and cross-session persistence, sanitized browser import/export. Validated mailto; exports cannot overwrite project files.
- Electron 45.5.0, pinned SQLCipher 4.20.0 Community/OpenSSL 3.6.5, static native build, sandboxed preload, CSP/IPC contracts, hardened fuses, audit, SBOM, coverage and real UI/installer/Portable tests.
- Final optical refinements approved; preserve the design. Both x64 editions: Nocturne Notes Setup.exe / Nocturne Notes Portable.exe, separate fixed profiles, file description Minimalist note editor.

## 2.0.0 — 24 November 2026
First public stable release: NSIS/Portable, separate Start Menu shortcut icon and stable Portable profile, English/Russian, optional tray, local SQLite notes, rich text, search/replace, recovery, trash, bounded undo, focus and always-on-top.


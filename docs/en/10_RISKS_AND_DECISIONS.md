# Risks and decisions

| Topic | Decision / limitation |
|---|---|
| Native transparent window | Keep accepted alpha path and eight grips; GPU/DPI variation needs manual testing. |
| Data safety | Local SQLite, atomic recovery, flush before switching/closing; backup .ns; no encryption. |
| Profiles | Installed keeps prior identity; Portable uses independent fixed AppData profile; experimental profiles are not migrated. |
| Multiple instances | Do not assume simultaneous editing of one project is safe; close the other instance first. |
| Tray | Opt-in, keep renderer/session alive; native Exit is full quit, no automatic Windows startup. |
| Signing | No signing credentials configured; Windows may show SmartScreen. SHA-256 verifies integrity, not publisher identity. |
| Spellcheck | Dictionary availability depends on Electron/OS, separate from two packaged UI locales. |
| Format | Legacy marker accepted, optional trash table, no schema changes without migration. |
| Preview | Browser demo is not the SQLite/Windows implementation. |
| History | Undo is bounded in memory; not persistent version history. |
| Export | Markdown conversion is basic, not lossless rich-text interchange. |
| Performance | CI benchmark synthetic, no guaranteed timings; Portable launcher may unpack before startup metrics. |
| Security | No sync/telemetry feature; external links open in browser, no security audit claim. |
| Release | Public rebuild from identical source is not guaranteed byte-identical to private accepted EXEs; publish corresponding checksums. |

Maintain explicit app identity and pinned dependencies. Keep artwork and design unchanged unless approved.

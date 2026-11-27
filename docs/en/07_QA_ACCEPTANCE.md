# Quality assurance — 2.5.0
Run on synthetic, isolated projects/profiles only. Do not equate browser preview with actual Windows application. The stable builds retain every necessary functional/security/package check; no repeated load or comparative performance benchmark on the accepted frozen source.

| Area | Acceptance |
|---|---|
| Source | 34 reviewed blob hashes; immutable lockfile, visual reference and assets, lint/types |
| Native/security | npm full/production audit, pinned OSV/NVD native review and actual runtime, SBOM, packaged fuses/ASAR/file list, exact local IPC and HTML policy |
| Storage | Current marker, plain/protected transactions, add-note atomicity, invalid DB/overwrite rejection, exclusive locking, alias and copy isolation, inode-zero fallback, hot journal rollback, recovery and protection |
| UI | Real desktop geometry, 740×480 minimum, odd/even widths, all eight resize zones, settings, dialogs, shortcuts, EN/RU, focus, tray, save indicators |
| Project lifecycle | Named save/Save As, temporary draft Save/Discard/Cancel, invalid/cancelled target, crash recovery with restore disabled, safe cleanup, second-instance handoff |
| Notes | Rich text, scoped search/replace, undo, pin order/constraints, duplicate/restore outside pinned group, trash, export and live search results |
| Lock | Three states, equal button appearance, immediate mask before flush, retry/cancel on injected failure, challenge validity, current password for change/remove, no auto-lock on tray |
| Preferences | Inject write failure; rollback, rapid sidebar clicks/keyboard, persistence across separate process restarts |
| Packaging | Both EXEs, correct names/version/description, exactly two UI locales, primary icon, actual native diagnostic, Portable visible named project, Setup install/uninstall/shortcuts/association and byte-identical retained user files |
| Network | Default session without observed application HTTP/WebSocket requests; optional spelling and OS paths are separate |

The accepted final validation included 86/86 unit tests, 60 alternating comparative project-load sessions and all mandatory CI gates. Separate optional extended tests remain available via benchmark scripts. Coverage applies only to instrumented files, not entire C++/Electron/UI. Record actual evidence, not assumed outcomes. Manual checks at available DPI/wallpapers, real hardware and both editions remain important. Never weaken a failed assertion merely to obtain a green build. See [risks](10_RISKS_AND_DECISIONS.md).

## Public release result
[Build #2](https://github.com/Chatonaut/Nocturne_Notes/actions/runs/45959605628) — SUCCESS; required gates, publication, 86 unit tests and checksums. Coverage of instrumented files: 99% lines, 85.23% branches, 98.15% functions. Four screenshots visually reviewed. [Release evidence](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Stable-build-evidence.zip). Extended load testing was not repeated.

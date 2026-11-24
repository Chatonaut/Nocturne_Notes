# Quality assurance

## Accepted 2.0.0 baseline (24 November 2026)
Owner manually accepted both editions. Original CI run completed successfully: 40/40 unit tests, visual lock, actual Electron UI, three alternating performance runs, packaging/ASAR/locale checks, PE icon verification, per-user install, real shortcut targets/icons, .ns registry command, first frame and uninstall preserving preferences. Native tray test proved save-and-hide, restore with undo, normal minimize, menu translation, disable/re-enable and Exit saving.

## Repeat for future releases
1. Verify frozen files and approved assets; npm ci, npm test, npm run test:ui. Do not substitute browser preview for desktop testing.
2. Check minimum 740×480, ordinary and maximized, odd/even widths, eight resize directions, 100/125/150/200% DPI where available, transparent corners on contrasting wallpapers, no startup flash.
3. Inspect title/caption clipping and tooltip, footer 36 px placement, focus/pin/history, sidebar collapse and drag, formatting and native context menu.
4. Verify all settings: default EN, live RU/EN, persisted locale and note text unaffected, horizontal sliders and all seven clickable font options, lower Application section with correct spacing, tray off by default; cancel does not commit.
5. Create/open/save/save-as projects, old marker, invalid DB rejected, long formatted text, duplicate, trash/restore/purge, last-note protection, reorder, search/replace both scopes, undo/redo, export and recovery after interruption. Work on disposable copies.
6. Tray: enable creates correct branded icon, tooltip; click/Open restores, minimize remains normal, close flushes and hides, Exit flushes then closes; save error must not hide; disabling removes icon.
7. Package both EXEs, confirm exactly two locale .pak files and expected ASAR; inspect all primary icons, Start Menu fill only, .ns association, install/upgrade/remove on disposable Windows, existing project/settings retained. Portable separate stable profile; no version in filename.
8. Compare performance against last accepted baseline when available; distinguish internal startup time from launcher unpacking, no guaranteed speed claims.
9. Record checksum and results. Any functional/data loss/visual regression blocks release. Manual hardware and Windows shell appearance remain owner acceptance tasks.

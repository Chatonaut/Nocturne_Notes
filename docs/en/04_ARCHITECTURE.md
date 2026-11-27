# Architecture — 2.5.0
Electron 45.5.0, vanilla HTML/CSS/JavaScript, Node main process, sandboxed renderer/preload, pinned npm lockfile. No account/server backend. Node 22 is the build/test CLI; Electron embeds its own Node runtime.

| Module | Responsibility |
|---|---|
| main.js | Window lifecycle, shape, menu/tray, project transitions, native dialogs, protection and validated IPC |
| preload.js | Narrow contextBridge API; native resize pointer capture |
| renderer.js | Editor, DOM, undo, search, serialized saving/recovery, settings, localization, privacy mask |
| index.html, styles.css, brand.css, windows-shell.css, features.css | Approved interface and shell |
| storage.js | ProjectStore, plain/encrypted transactions, logical copy, trash, pins, metadata |
| cipher-db.js, native/cipher.cc | Node-API bridge and SQLCipher; static OpenSSL, /MT CRT |
| recovery.js, drafts.js | Exact file identity, atomic recovery, managed temporary lifecycle |
| content-policy.js, html-content.js | DOM/parse5 HTML policy, text/Markdown/HTML export |
| ipc-contract.js, types/contracts.d.ts | Payload validation and typed contracts, exact trusted local document URL |
| search.js, undo-buffer.js | Compact text offsets, scoped matching and bounded session history |
| settings.js, i18n.js | Validated settings and EN/RU strings |
| window-shape.js, corner-resize.js | Shape and bounds; coalesced native resize |
| preview-api.js | Browser-only localStorage/JSON preview, not desktop .ns storage |
| scripts/, tests/, build/installer.nsh | Build, audit, regression, packaging, NSIS shortcut icon |

Renderer: contextIsolation, sandbox, webSecurity, no Node integration. CSP; IPC validates exact WebContents/main frame and expected local file URL (normalizes equivalent unreserved URL characters only), checks payloads in main/storage. Only validated HTTP(S)/mailto links are delegated to OS. Browser preview sanitizes import/update/export too. ASAR integrity and ASAR-only loading enabled; RunAsNode, Node environment options and inspect CLI disabled in packaged Electron. Native diagnostics accept synthetic fixtures only.

Preferences are `userData/preferences.json`, with drafts and recovery subdirectories. Installed profile `%APPDATA%/Nocturne Notes`; Portable `%APPDATA%/Nocturne Notes Portable`, detected with PORTABLE_EXECUTABLE_FILE when packaged. Separate application IDs and profiles. Native window starts hidden until project, styles and renderer frames are ready; tray hide occurs only after successful flush. Actual exit is acknowledged; failure does not silently hide or discard. Protected lock masks UI before flush, then closes DB and clears editor/session data. See [NS format](05_NS_FORMAT.md) and [build](06_BUILD_GITHUB.md).

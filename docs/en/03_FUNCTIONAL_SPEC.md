# Functional specification

## Projects and notes
First launch without a restorable project creates a local draft with one empty note. New Project creates a draft; Open uses a native .ns chooser; Recent lists up to eight real existing files, excluding drafts. Save writes an existing project; unsaved drafts use Save As. Save As verifies a logical copy of the complete database before changing active path. Caption uses the project filename without extension (New Project for drafts). Existing user titles are not translated when changing UI language.

Create, rename (F2), duplicate, select, drag-reorder and move notes to the project-local trash. The last active note cannot be removed. Restore and permanently delete trashed notes through the trash dialog. Duplication uses a localized copy suffix; ordinary duplicates insert after their source, while copies of pinned notes remain ordinary. Title limit 250 characters, body HTML limit 5,000,000 characters.

## Editing and search
Rich text: bold, italic, underline, strikethrough, H1–H5, ordered/unordered lists, links and 35 colors. Selection toolbar follows actual formatting. Paste/render sanitization prevents unsafe markup; native dark context menu provides edit actions and spelling suggestions when available. Search title and body in active note or entire project. Enter/Shift+Enter navigate matches. Replace only in selected scope and text nodes, preserving untouched formatting. Search temporarily widens a narrow sidebar to at least 220 px, restoring its width afterward. Export an individual note as TXT, HTML or basic Markdown.

Session undo/redo covers title and HTML: 50 logical steps per note, shared approximate 64 MiB budget; history is not written to disk. Focus F11/Esc and always-on-top Ctrl+Shift+T are independent window features.

## Settings
| Setting | Range/options | Default |
|---|---|---|
| Editor font | Segoe UI Variable, Arial, Calibri, Verdana, Tahoma, Georgia, Times New Roman | Segoe UI Variable |
| Title | 15–35 px | 20 |
| Body | 10–35 px | 17 |
| Line spacing | 1.0–2.0, step 0.1 | 1.1 |
| Formatting toolbar | on/off | on |
| Save indicators | on/off | on |
| Spellcheck | English/Russian, available dictionaries | off |
| Autosave after input | 1–20 min, slider, step 1 min | 1 min |
| Restore last project | on/off | on |
| App language | English/Russian | English |
| Minimize to tray on close | on/off | off |

Changes commit only on Save; toggles respond to their own control. Language updates interface, hints, menus, dialogs, errors and native tray without changing existing note text or current undo session. Windows-owned dialog controls can follow OS language. When tray is enabled, close flushes then hides; left click/Open restores, Exit flushes and quits. Normal minimize remains unchanged. Failed save prevents hiding or exiting.

## Persistence
Active status: green saved, yellow pending, red error. Recovery writes an atomic local draft approximately 450 ms after edits; successful project save removes it. Flush on note/project switch, blur, visibility loss and close. Restore available previous file and saved geometry; missing or invalid files must not be silently overwritten. Preferences and recovery live outside the .ns file.

## Project transitions, safety and protection
Save As creates a verified logical copy, preserving the old source; explicit overwrite rules apply. Project operations are serialized with pending saves/recovery and temporarily block edits. Batch replacement validates all edits before one SQLite transaction; failed reorder does not change the displayed order. Unicode offsets refer to original text. Dense search uses compact offsets and caps displayed highlights (2,000 plus the current match), not navigation/counts. Validated mailto links are supported. Export must not overwrite .ns. Protected projects use password dialogs, explicit lock/unlock and password change/removal; protected recovery is stored inside the encrypted database. See [format](05_NS_FORMAT.md) and [user guide](USER_GUIDE.md).

### Owner-approved final refinements
Protection submenu is text-only: Set password, Lock, Unlock, Change password, Remove password, shown as applicable; the top-level shield and password visibility icons remain. Width follows text, bounded by available window space; other menus unchanged. Minimum new password 8 Unicode code points in UI and IPC. No automatic locking on minimize or tray. Empty newly created notes are already persisted, so the saved (green) indicator is correct. Pending and failed writes use the existing other indicators.

Every text submenu (protection, recent and export) has symmetric 1 px optical clearance on each side of its labels; original button padding and adaptive width remain. Authored dialog descriptions have no final periods; internal sentence punctuation is retained and text wraps naturally without forced line breaks. User content and filenames are unchanged.

### Temporary drafts and pinned notes
An unnamed project is temporarily persisted to a generated UUID file in the private drafts directory. Actual close/exit and transitions to another project ask Save / Don't save / Cancel if the draft has content (including multiple notes, trash, pin or password). Cancel or cancelled/failed saving keeps the draft. A cancelled open picker, incorrect target password or invalid target must not remove the current draft. Delete a discarded draft only after successful transition or actual exit; delete it after successful verified Save As. Unmodified empty draft exits without a question. Tray hide and minimize do not prompt or clean. Startup clears stale managed drafts, except the marked interrupted active draft and its sidecars; automatic recovery survives restore-last-project disabled. User-named files are not cleaned. Pin/Unpin appears immediately below Duplicate, same contour bookmark both states, to the left of the active save indicator; pinned notes move into a fixed top group, appending new pins; unpin moves to the first ordinary row. Ordinary notes reorder freely below the group. A thin 1 px divider appears only between two visible groups. Pinned notes remain editable and duplicable but cannot be moved or deleted until unpinned. Copies and restored notes stay in the ordinary group. Pin state belongs to project, not preferences. New password dialogs use adaptive width up to 455 px and discard dialog up to 510 px, standard 35 px footer buttons and 22 px top clearance, natural text wrapping, no trailing periods.

The note context menu has intrinsic adaptive width, original icon size and symmetric optical clearance, clamped to the window. F2 remains a rename shortcut but is no longer printed in the menu. Project search results update as the note body/title changes; note rows are reused when their IDs remain visible. Drag only originates from an actual note drag inside the list.

### Panic lock
The desktop titlebar lock button and Ctrl+Shift+L use the existing password-protected lock operation. The button retains normal color and opacity in all three protection states. For a plain project it opens the existing Set password dialog; successful setup leaves the project open. For an open protected project it locks immediately. For an already locked project it opens the existing password challenge; wrong password or cancellation leaves the project locked. The shortcut has the same behavior in focus mode. A temporary operation guard prevents overlapping actions without dimming the button. The locked heading glyph alone is optically lowered by 1 px. Immediately conceal note content, titles, list and search before flushing pending edits; after successful flush close the encrypted DB and clear editor, history and search. If saving fails, keep concealed and offer retry or explicit Cancel. No confirmation on successful lock. The locked title has the same contour lock and Project locked, no body text/placeholder. No auto-lock on tray or minimize. Autosave uses a whole-minute slider, plus/minus and localized minute readout; default and independent recovery timing unchanged.

All application-owned dialog text buttons use a shared one-pixel upward optical correction in features.css: footers (35 px), trash actions, settings choices and dropdown labels. Retain all original control dimensions, horizontal alignment, icon centers, margins and colors. Native Windows dialogs and non-dialog controls are not restyled.


Note creation and active-note metadata are committed atomically. Ordinary recovery is keyed by exact file identity, not merely its pathname; canonical-path fallback is restricted to a single-link file when file IDs are unavailable. Save As and protection changes refuse unsafe targets with multiple hard links. Sidebar collapse is persisted; a failed write restores the last confirmed state and reports the error.

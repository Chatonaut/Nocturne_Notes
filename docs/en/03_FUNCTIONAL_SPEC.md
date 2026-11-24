# Functional specification

## Projects and notes
First launch creates a local draft with one empty note. New Project creates a draft; Open uses a native .ns chooser; Recent lists up to eight real existing files, excluding drafts. Save writes an existing project; unsaved drafts use Save As. Save As copies the complete closed SQLite database before changing active path. Caption uses the project filename without extension (New Project for drafts). Existing user titles are not translated when changing UI language.

Create, rename (F2), duplicate, select, drag-reorder and move notes to the project-local trash. The last active note cannot be removed. Restore and permanently delete trashed notes through the trash dialog. Duplication inserts after source with localized copy suffix. Title limit 250 characters, body HTML limit 5,000,000 characters.

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
| Autosave after input | 1/3/5 min | 1 min |
| Restore last project | on/off | on |
| App language | English/Russian | English |
| Minimize to tray on close | on/off | off |

Changes commit only on Save; toggles respond to their own control. Language updates interface, hints, menus, dialogs, errors and native tray without changing existing note text or current undo session. Windows-owned dialog controls can follow OS language. When tray is enabled, close flushes then hides; left click/Open restores, Exit flushes and quits. Normal minimize remains unchanged. Failed save prevents hiding or exiting.

## Persistence
Active status: green saved, yellow pending, red error. Recovery writes an atomic local draft approximately 450 ms after edits; successful project save removes it. Flush on note/project switch, blur, visibility loss and close. Restore available previous file and saved geometry; missing or invalid files must not be silently overwritten. Preferences and recovery live outside the .ns file.

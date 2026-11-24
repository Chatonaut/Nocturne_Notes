# User guide

## Install or run
Download the two Windows x64 options from [Releases](https://github.com/Chatonaut/Nocturne_Notes/releases). Setup installs per user with a selected directory, shortcuts and .ns association. Portable runs without installation; it still stores preferences and recovery in AppData. Verify SHA-256 using Get-FileHash. The EXEs are not digitally signed; Windows may show a publisher warning. Only download from the official repository and verify the checksum.

## Work with projects
Start with a blank note; create notes using +, name and format them, drag to reorder. Use Save/Save As to choose your .ns file. A project is one local SQLite file with all notes and trash. Copy the closed .ns file to back up or move it. Open old projects directly or use a backup first. Right-click a note for supported operations; deleted notes go to the project trash. Permanently deleting from trash cannot be undone by session Undo.

## Editing and settings
Select text to format; find or replace in one note or all notes. Export the current note as TXT, HTML or MD. In Settings choose font, title/body size, spacing, autosave, indicators, spelling and restore. Application section selects language and optional tray mode. Save applies settings. English default. When tray is on, the cross hides after saving; click the branded tray icon to return or right-click Exit to quit. The Windows tray may place icons in its overflow area.

## Shortcuts
| Keys | Action |
|---|---|
| Ctrl+N / Ctrl+Shift+N | New note / project |
| Ctrl+O | Open project |
| Ctrl+S / Ctrl+Shift+S | Save / Save As |
| Ctrl+F / Ctrl+H | Find / replace |
| Enter / Shift+Enter in search | Next / previous match |
| Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z | Undo / redo |
| Ctrl+B / Ctrl+I / Ctrl+U | Bold / italic / underline |
| Ctrl+Backslash | Toggle notes sidebar |
| F2 | Rename active note |
| F11 / Esc | Focus mode / leave focus |
| Ctrl+Shift+T | Always on top |

Uninstall does not delete .ns projects or preferences. Files are local and unencrypted; protect sensitive notes with Windows access controls and backups. No account or cloud sync.

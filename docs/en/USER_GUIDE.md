# User guide

## Install or run
Choose one of the two Windows x64 options from [Releases](https://github.com/Chatonaut/Nocturne_Notes/releases). Setup installs per user with a selected directory, shortcuts and .ns association. Portable runs without installation; it still stores preferences and recovery in AppData. Verify SHA-256 using Get-FileHash. The EXEs are not digitally signed; Windows may show a publisher warning. Only download from the official repository and verify the checksum.

## Work with projects
Start with a blank note; create notes using +, name and format them, drag to reorder. Use Save/Save As to choose your .ns file. A project is one local SQLite or protected SQLCipher file with all notes and trash. Copy the closed .ns file to back up or move it. Right-click a note for supported operations; deleted notes go to the project trash. Permanently deleting from trash cannot be undone by session Undo.

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
| Ctrl+Shift+L | Set password / lock / unlock |

Uninstall does not delete .ns projects or preferences. Plain projects are not encrypted; use optional project protection for sensitive notes, plus Windows access controls and backups. No account or cloud sync.

## Password protection
Make a backup before changing protection. In Project protection, choose Set password, enter and confirm a password (at least 8 Unicode code points); protected projects prompt on opening. Lock is explicit; choose Unlock and enter the password. Minimize, tray hide/restore and note switching do not request it again in the same unlocked session. Change password and Remove password require the current password. Change or remove protection from the same menu, using the current password. Keep a backup and the password safely: there is no reset. File names are visible; prior plaintext copies and exported TXT/HTML/MD are not encrypted (export warns). Closing and reopening requires the password; do not assume automatic locking when minimizing or switching focus. Never edit one project concurrently from two editions.

### Temporary projects and pinned notes (2.5)
Use Save or Save As to choose a permanent location. For a nonempty unnamed project, actual exit or changing projects asks Save / Don't save / Cancel. Don't save permanently discards the draft after the successful transition; Cancel keeps it. Closing to the tray does not discard it. After an interrupted session, the active draft can be recovered even if ordinary restore is disabled. Old managed drafts are cleaned on startup. In the note context menu choose Pin (bookmark) to move the note into the fixed top group and prevent deletion; new pins append to the group, Unpin places the note first in the ordinary group. Ordinary notes reorder freely below the pins. Editing and duplication remain available; copies are not pinned. Pin metadata follows the project, including protected projects. 

Use the top-bar lock or Ctrl+Shift+L to conceal and lock an open protected project, including in focus mode. Pending edits are saved before locking. If writing fails, the document stays concealed; retry or explicitly cancel to return. Press the same lock button or Ctrl+Shift+L again, or use Unlock in the protection menu; all require the password. The locked editor shows only a lock and Project locked. The autosave slider accepts 1–20 minutes in one-minute steps, default 1 minute; crash recovery remains independent.

The titlebar lock button and Ctrl+Shift+L also open Set password for an unprotected project; cancel changes nothing. After successful setup the project remains open; press again to lock. The button looks equally bright in all protection states.


### Verify a download
Use PowerShell `Get-FileHash -Algorithm SHA256 'Nocturne Notes Setup.exe'` (or `Nocturne Notes Portable.exe`) and compare with the matching line in the release's `SHA256SUMS.txt`. Installed preferences are under `%APPDATA%/Nocturne Notes`; Portable has its own `%APPDATA%/Nocturne Notes Portable`. Portable does not automatically register .ns associations or install shortcuts. Close the other edition before opening the same project.

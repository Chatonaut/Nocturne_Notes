# NS project format

One named project = one SQLite or password-protected SQLCipher database file with extension .ns, not JSON, Markdown or ZIP. Plain signature: SQLite format 3 followed by NUL. Both use user_version=1, journal_mode=DELETE, synchronous=FULL and exclusive locking while open.

```sql
CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, html TEXT NOT NULL,
  sort_order INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX notes_order_idx ON notes(sort_order);
PRAGMA user_version=1;
```

Metadata keys: format = nocturne-notes-v1; created_at = Unix milliseconds as text; active_note = UUID. Only the current marker nocturne-notes-v1 is accepted. Notes use UUID, title up to 250 characters, formatted HTML up to 5,000,000 characters, integer sort_order and Unix millisecond updated_at. Unknown SQLite or empty/corrupt projects are rejected before modification.

Optional note_trash(id,title,html,sort_order,updated_at,deleted_at) is created lazily in a transaction. Trash/restore preserves UUID and HTML; restoration places note at its prior position bounded by current list. Permanent deletion is final. Use backups. Reordering and duplication use transactions. ProjectStore is the sole writer. Save As verifies a logical copy before switching to it. Close the application before backing up or moving a file; journal/recovery side files may exist during edits. Undo is session-only. Do not alter schema or marker without explicit approval and a data-safety plan.

## Password protection
Unprotected .ns remains the existing SQLite format and schema version 1. A protected .ns is SQLCipher 4.20.0, with encrypted header, pages and protected recovery; it is not readable by ordinary SQLite. The password is not stored in preferences. Password change/removal and Save As create verified logical copies before replacement; use backups. Protected recovery is inside the database, not a plaintext sidecar. Plain recovery uses atomic flushed writes; abandoned per-project recovery temp files are removed before protection. Password protection does not hide filenames, erase historical plaintext copies or protect plaintext exports. Never open the same project for simultaneous editing.

### Rollback journal
A `.ns-journal` is SQLite's rollback journal. DELETE journal mode, FULL synchronous writes and exclusive locking remain unchanged; a journal can stay beside an open project until close. Do not delete or move it independently while a project is open or after a crash. SQLCipher encrypts the rollback page content of protected databases; journal headers and structural metadata are not necessarily encrypted. The expanded test forces a real hot journal, checks synthetic plaintext markers in the journal and database, interrupts the writing process, verifies rollback, trash and encrypted recovery, and checks orderly cleanup. Plain projects and pre-protection copies are not encrypted. Converting a project cannot securely erase deleted disk blocks, old backups, snapshots or OS paging data. Eight Unicode code points are the new minimum; longer unique passwords are recommended.

### Pinned metadata and temporary files
Optional `project_meta.pinned_notes` is a JSON array of note UUIDs; absent means no pins. No new table, column, schema version or format marker. Copies preserve the complete metadata, including encryption/change/remove password. Managed drafts use private direct `draft-<UUID>.ns` names and matching SQLite/temporary sidecars; activeDraft in preferences identifies interrupted sessions, never contains password or note content. Startup and confirmed exit only clean managed direct regular files, not user-named files or directory links. Preserve current interrupted file and recovery until successfully saved/discarded. Deleted files are not securely erased.

Pinned IDs remain in the existing metadata array; the existing sort_order holds the actual order. At open, the stored layout is stably partitioned into pinned and ordinary groups in one transaction only if necessary. IDs, timestamps, titles, HTML, active ID and trash remain unchanged. New pins append to the prefix, unpin inserts at the boundary; duplication and restoration cannot enter the prefix. No change to schema version or encryption.


### Recovery identity
Plain recovery is an atomic JSON sidecar in the edition's private recovery directory, named by SHA-256 of exact BigInt device, inode and birthtimeNs. Where inode is zero, use native realpath and birthtimeNs only for a known single-link regular file; ambiguous identities fail closed. Same-file aliases share recovery when identity is available; copies and replacements do not. Identity is rechecked before writing. Named project files with multiple hard links cannot be replaced by protection or overwrite operations. Protected recovery uses the optional `protected_recovery(id,title,html,updated_at)` table inside the encrypted database. No cross-edition recovery-sharing or recovery of an externally deleted/replaced project is guaranteed.

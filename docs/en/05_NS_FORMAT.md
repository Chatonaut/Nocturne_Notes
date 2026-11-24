# NS project format

One project = one SQLite 3 file with extension .ns, not JSON, Markdown or ZIP. Signature SQLite format 3 followed by NUL, user_version=1, journal_mode=DELETE and synchronous=FULL. The file is not encrypted.

```sql
CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, html TEXT NOT NULL,
  sort_order INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX notes_order_idx ON notes(sort_order);
PRAGMA user_version=1;
```

Metadata keys: format = nocturne-notes-v1; created_at = Unix milliseconds as text; active_note = UUID. The legacy glass-notes-v1 marker is accepted without rewriting it on ordinary open. Notes use UUID, title up to 250 characters, formatted HTML up to 5,000,000 characters, integer sort_order and Unix millisecond updated_at. Unknown SQLite or empty/corrupt projects are rejected before modification.

Optional note_trash(id,title,html,sort_order,updated_at,deleted_at) is created lazily in a transaction. Trash/restore preserves UUID and HTML; restoration places note at its prior position bounded by current list. Permanent deletion is final. Older versions may ignore trash; use backups. Reordering and duplication use transactions. ProjectStore is the sole writer. Save As closes the source DB before copying, then opens the copy. Close the application before backing up or moving a file; journal/recovery side files may exist during edits. Undo is session-only. Do not alter schema or marker without migration plan and backup.

# Формат проекта NS

Один проект = один файл SQLite 3 с расширением .ns, не JSON, Markdown или ZIP. Сигнатура SQLite format 3 с завершающим NUL, user_version=1, journal_mode=DELETE и synchronous=FULL. Файл не шифруется.

```sql
CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, html TEXT NOT NULL,
  sort_order INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX notes_order_idx ON notes(sort_order);
PRAGMA user_version=1;
```

Метаданные: format = nocturne-notes-v1; created_at = Unix-миллисекунды строкой; active_note = UUID. Старый маркер glass-notes-v1 принимается без перезаписи при обычном открытии. Заметки: UUID, заголовок до 250 символов, HTML до 5 000 000 символов, целый sort_order и updated_at в Unix-миллисекундах. Чужая SQLite или пустой/поврежденный проект отклоняются до изменения.

Дополнительная note_trash(id,title,html,sort_order,updated_at,deleted_at) создается лениво в транзакции. Корзина/восстановление сохраняют UUID и HTML; восстановление возвращает позицию в пределах текущего списка. Окончательное удаление необратимо. Старые версии могут не видеть корзину; использовать копии. Сортировка и дублирование транзакционные. ProjectStore — единственный писатель. «Сохранить как» закрывает БД перед копированием и открывает копию. Перед резервным копированием или переносом закрыть приложение; при записи возможны журнальные/recovery-файлы. Undo только в сессии. Не менять схему и маркер без миграции и резервной копии.

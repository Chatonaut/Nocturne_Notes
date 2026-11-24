# Архитектура

Electron 45.4.1: главный процесс и изолированный renderer, обычные HTML/CSS/JS, SQLite через node:sqlite. Без дополнительного UI-фреймворка и внешней runtime-зависимости БД. npm ci использует фиксированный lockfile; Node 22 — CLI сборки и тестов.

| Модуль | Ответственность |
|---|---|
| main.js | Жизненный цикл окна, нативный resize, меню/трей, IPC проектов и настроек, диалоги |
| preload.js | Явный contextBridge API, захват указателя resize |
| renderer.js | Редактор, DOM, состояние, история, сохранение/recovery, настройки, локализация |
| index.html / styles.css | Замороженный интерфейс и стили |
| brand.css / windows-shell.css / features.css | Согласованная графика, Windows-оболочка и дополнения |
| storage.js | ProjectStore, транзакции SQLite, валидация формата, корзина |
| recovery.js | Атомарные recovery-снимки по пути |
| search.js / undo-buffer.js | Поиск по тексту и сессионная история |
| settings.js / i18n.js | Проверенные настройки и словарь EN/RU |
| window-shape.js / corner-resize.js | Расчет нативной формы и границ |
| preview-api.js | Браузерная демонстрация localStorage/JSON; не desktop-хранилище .ns |
| build/installer.nsh / scripts/ | NSIS-настройка, проверки, бенчмарки и тесты |

Renderer использует contextIsolation, без Node integration, webSecurity включен; preload предоставляет ограниченный IPC. sandbox выключен для существующего preload, не расширять границы доступа. Проверять данные в main/storage; избегать произвольного IPC и внешней навигации. Только ссылки HTTP(S) передаются ОС. Нет сервера и аккаунтов.

Настройки: app.getPath('userData')/preferences.json; отдельные каталоги drafts и recovery. Установленная редакция сохраняет существующий профиль Electron и app ID; Portable использует %APPDATA%/Nocturne Notes Portable и отдельный ID панели задач, определяется PORTABLE_EXECUTABLE_FILE. Portable не полностью самодостаточен по данным. Запуск скрыт до готовности renderer и стилей. Трей существует только при включении; подтверждение сохранения определяет скрытие/выход. Before-quit запрашивает полный выход. Не менять запуск и идентификаторы без явной регрессионной проверки.

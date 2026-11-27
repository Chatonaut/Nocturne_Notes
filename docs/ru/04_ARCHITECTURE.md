# Архитектура — 2.5.0
Electron 45.5.0, обычные HTML/CSS/JavaScript, главный процесс Node, изолированные renderer/preload с sandbox, закрепленный npm lockfile. Нет серверной части и аккаунтов. Node 22 — CLI сборки/тестов; Electron содержит собственный Node.

| Модуль | Назначение |
|---|---|
| main.js | Жизненный цикл окна, форма, меню/трей, переходы проектов, диалоги, защита и проверяемый IPC |
| preload.js | Узкий contextBridge API; захват указателя нативного resize |
| renderer.js | Редактор, DOM, undo, поиск, последовательные сохранение/recovery, настройки, язык, маска приватности |
| index.html, styles.css, brand.css, windows-shell.css, features.css | Утвержденный интерфейс и оболочка |
| storage.js | ProjectStore, транзакции обычных/защищенных БД, логические копии, корзина, закрепления, метаданные |
| cipher-db.js, native/cipher.cc | Node-API и SQLCipher; статический OpenSSL, CRT /MT |
| recovery.js, drafts.js | Точный ID файла, атомарное восстановление, управляемые временные проекты |
| content-policy.js, html-content.js | Политика HTML DOM/parse5, экспорт TXT/Markdown/HTML |
| ipc-contract.js, types/contracts.d.ts | Проверка параметров, типизированные контракты, точный доверенный локальный URL |
| search.js, undo-buffer.js | Компактные смещения, поиск по области, ограниченная история сессии |
| settings.js, i18n.js | Проверенные настройки и строки EN/RU |
| window-shape.js, corner-resize.js | Форма/границы, coalesced resize |
| preview-api.js | Браузерный localStorage/JSON-просмотр, не desktop .ns |
| scripts/, tests/, build/installer.nsh | Сборка, аудит, регрессии, упаковка, иконка ярлыка NSIS |

Renderer: contextIsolation, sandbox, webSecurity, без Node. CSP; IPC проверяет точный WebContents/главный фрейм и ожидаемый локальный URL (нормализуются только эквивалентные незарезервированные символы), проверка параметров main/storage. Только проверенные HTTP(S)/mailto передаются ОС. Браузерный просмотр также очищает импорт/изменения/экспорт. В упакованном Electron включены целостность ASAR и загрузка только ASAR, отключены RunAsNode, переменные Node и inspect CLI. Нативная диагностика использует только синтетические данные.

Настройки — `userData/preferences.json`, подкаталоги drafts и recovery. Setup: `%APPDATA%/Nocturne Notes`; Portable: `%APPDATA%/Nocturne Notes Portable`, определяется PORTABLE_EXECUTABLE_FILE в упаковке. Отдельные ID и профили. Нативное окно скрыто до готовности проекта, стилей и кадров renderer; трей скрывает только после успешной записи. Реальный выход подтверждается; сбой не скрывает и не отбрасывает данные молча. При блокировке защищенного проекта интерфейс скрывается до записи, затем БД закрывается, редактор и история очищаются. См. [формат NS](05_NS_FORMAT.md) и [сборку](06_BUILD_GITHUB.md).

<p align="center"><img src="assets/nocturne-brand-mark.png" width="116" alt="Nocturne Notes logo"></p>

<h1 align="center">Nocturne Notes</h1>
<p align="center"><strong>Минималистичный редактор заметок</strong></p>
<p align="center">Тихое пространство для ваших мыслей.</p>
<p align="center">Windows 11 x64 · Открытый исходный код</p>

<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/Chatonaut/Nocturne_Notes?label=release"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml"><img alt="Windows build" src="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/github/license/Chatonaut/Nocturne_Notes"></a>
</p>

<p align="center">
  <a href="docs/ru/01_PASSPORT.md"><img alt="Windows 11 x64" src="https://img.shields.io/badge/Windows-11%20x64-336699"></a>
  <a href="docs/ru/04_ARCHITECTURE.md"><img alt="Electron" src="https://img.shields.io/badge/Electron-45.5.0-536878"></a>
  <a href="docs/ru/05_NS_FORMAT.md"><img alt="SQLCipher" src="https://img.shields.io/badge/SQLCipher-4.20.0-536878"></a>
  <a href="docs/ru/04_ARCHITECTURE.md"><img alt="OpenSSL" src="https://img.shields.io/badge/OpenSSL-3.6.5-536878"></a>
  <a href="docs/ru/05_NS_FORMAT.md"><img alt="Local files" src="https://img.shields.io/badge/Storage-local-536878"></a>
  <a href="docs/ru/USER_GUIDE.md"><img alt="Languages" src="https://img.shields.io/badge/Languages-EN%20%7C%20RU-536878"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.ru.md">Русский</a></p>
<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><strong>Скачать</strong></a> ·
  <a href="docs/ru/USER_GUIDE.md">Руководство</a> ·
  <a href="docs/ru/CHANGELOG.md">Что нового</a> ·
  <a href="docs/ru/00_START_HERE.md">Документация</a> ·
  <a href="https://github.com/Chatonaut/Nocturne_Notes/issues">Обратная связь</a>
</p>


---

Nocturne Notes — бесплатный редактор заметок с открытым исходным кодом для Windows 11. Создавайте форматированные заметки в локальных проектах, работайте без интернета и при необходимости защищайте проекты паролем. Аккаунт и облачный сервис не нужны.

![Редактор Nocturne Notes](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Editor.png)

## Скачать

[Последний стабильный релиз](https://github.com/Chatonaut/Nocturne_Notes/releases/latest) · [Все релизы](https://github.com/Chatonaut/Nocturne_Notes/releases)

**Системные требования:** Windows 11, x64. Обе редакции имеют одинаковые функции.

| Setup | Portable |
|---|---|
| [Nocturne Notes Setup.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Setup.exe) | [Nocturne Notes Portable.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Portable.exe) |
| Установка для пользователя, выбор папки, ярлыки и ассоциация .ns | Запуск напрямую, без установки |
| Профиль: `%APPDATA%/Nocturne Notes` | Отдельный профиль: `%APPDATA%/Nocturne Notes Portable` |

Portable не хранит весь профиль рядом с EXE. Проверяйте файлы по [контрольным суммам SHA-256](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/SHA256SUMS.txt) релиза. GitHub может заменить пробелы в именах файлов точками; сравнивайте значения хешей. EXE не подписаны, поэтому Windows SmartScreen может показать предупреждение. [Установка и проверка файлов](docs/ru/USER_GUIDE.md).

## Возможности

- **Редактирование:** форматирование текста, настройка типографики, режим концентрации и поверх окон.
- **Организация:** несколько заметок в проекте, закрепления, перетаскивание, корзина и восстановление.
- **Поиск:** поиск и замена в заметке или во всем проекте.
- **Защита:** опциональное шифрование SQLCipher, управление паролем и быстрая ручная блокировка.
- **Восстановление:** автосохранение, независимое аварийное восстановление, временные черновики и отмена/повтор.
- **Экспорт:** TXT, HTML и Markdown.
- **Настройки:** английский и русский интерфейс, опциональный трей, проверка орфографии и параметры редактора.

В версии 2.5 появились защита проектов, временные черновики и закрепление заметок, улучшены поиск, восстановление и надежность. [Полная история изменений](docs/ru/CHANGELOG.md).

## Скриншоты

| Настройки | Защита проекта |
|---|---|
| ![Настройки](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Settings.png) | ![Установка пароля](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Protection.png) |

[Заблокированный проект](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Locked.png). На скриншотах показано приложение с демонстрационными заметками. Файлы и скриншоты 2.5.0 доступны вместе с [релизом 2.5.0](https://github.com/Chatonaut/Nocturne_Notes/releases/tag/v2.5.0).

## Ваши данные

Проекты — локальные файлы баз данных .ns. Обычные проекты используют SQLite, защищенные паролем — SQLCipher. Защита распространяется на заголовки заметок, корзину и данные восстановления внутри защищенной базы.

- Обычные проекты, имена файлов, буфер обмена, открытый экспорт и прежние копии не зашифрованы.
- Сброса пароля и безопасного стирания нет. Сворачивание и скрытие в трей не блокируют проект автоматически.
- Перед копированием и резервным сохранением проекта закройте приложение. Не редактируйте проект одновременно из двух процессов.
- В стандартном сетевом тесте HTTP/WebSocket-запросы приложения не наблюдались. Опциональные словари и внешние ссылки — отдельные функции.

[Формат проекта](docs/ru/05_NS_FORMAT.md) · [Ограничения защиты](docs/ru/10_RISKS_AND_DECISIONS.md)

## Документация

| Пользователям | Разработчикам |
|---|---|
| [Руководство и горячие клавиши](docs/ru/USER_GUIDE.md) | [Сборка из исходников](docs/ru/06_BUILD_GITHUB.md) |
| [История изменений](docs/ru/CHANGELOG.md) | [Архитектура](docs/ru/04_ARCHITECTURE.md) |
| [Вся документация](docs/ru/00_START_HERE.md) | [Контроль качества](docs/ru/07_QA_ACCEPTANCE.md) |

## Сборка и проверки

Electron, JavaScript, HTML/CSS и нативный модуль SQLCipher/OpenSSL. [Windows CI](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml) независимо собирает обе редакции, проверяет зависимости, работу приложения, нативную библиотеку, упаковку и установщик. В процессе формируются отчеты аудита и списки программных компонентов (SBOM).

## Обратная связь

[Сообщить об ошибке или предложить улучшение](https://github.com/Chatonaut/Nocturne_Notes/issues). Укажите версию приложения, Setup или Portable, версию Windows, шаги воспроизведения, ожидаемый и фактический результат. Используйте демонстрационные данные; не прикладывайте личные заметки, реальные базы проектов и пароли.

## Лицензия

[MIT](LICENSE). Уведомления и применимые лицензии сторонних компонентов входят в Windows-сборку.

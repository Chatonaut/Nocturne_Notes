<p align="center"><img src="assets/nocturne-brand-mark.png" width="100" alt="Nocturne Notes"></p>

<h1 align="center">Nocturne Notes</h1>
<p align="center"><strong>Минималистичный редактор заметок</strong> · Windows 11 x64 · 2.5.0</p>
<p align="center">Спокойное пространство для заметок, идей и сосредоточенной работы.</p>

[English](README.md) · Русский

[![Release](https://img.shields.io/github/v/release/Chatonaut/Nocturne_Notes?label=Release)](https://github.com/Chatonaut/Nocturne_Notes/releases/latest) [![Windows CI](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg)](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml) [![Downloads](https://img.shields.io/github/downloads/Chatonaut/Nocturne_Notes/total)](https://github.com/Chatonaut/Nocturne_Notes/releases) [![MIT](https://img.shields.io/github/license/Chatonaut/Nocturne_Notes)](LICENSE) ![Windows](https://img.shields.io/badge/Windows-11%20x64-336699) ![Electron](https://img.shields.io/badge/Electron-45.5.0-536878) ![SQLCipher](https://img.shields.io/badge/SQLCipher-4.20.0-536878) ![Offline](https://img.shields.io/badge/Offline-local-536878)

## Скачать

[Последний релиз](https://github.com/Chatonaut/Nocturne_Notes/releases/latest) · [Все релизы](https://github.com/Chatonaut/Nocturne_Notes/releases)

| Редакция | Setup | Portable |
|---|---|---|
| Файл | [Nocturne Notes Setup.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Setup.exe) | [Nocturne Notes Portable.exe](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne.Notes.Portable.exe) |
| Установка | Для пользователя, выбор каталога | Не нужна |
| Интеграция Windows | Ярлыки и ассоциация .ns | Запуск EXE напрямую |
| Профиль | %APPDATA%/Nocturne Notes | %APPDATA%/Nocturne Notes Portable |
| Проекты и функции | Одно приложение | Одно приложение |

Проверьте [SHA256SUMS.txt](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/SHA256SUMS.txt) соответствующего релиза. GitHub может заменить пробелы в именах скачиваемых файлов точками; сравните значения SHA-256 или переименуйте файлы как в манифесте. EXE без подписи могут вызвать SmartScreen; сумма проверяет целостность, не издателя. Portable имеет отдельный локальный профиль, а не полностью автономный профиль.

## Рабочее пространство, а не сервис

- Форматирование, семь системных шрифтов, размеры заголовка/текста и интервал, ограниченная история отмены/повтора.
- Один локальный проект .ns с несколькими заметками, корзиной и закреплениями; поиск/замена в заметке или во всем проекте.
- Опциональная защита SQLCipher, ручная блокировка/разблокировка, Ctrl+Shift+L; не нужны аккаунт и облако.
- Временные проекты Сохранить/Не сохранять/Отмена, независимое восстановление, закрепление, концентрация, поверх окон, опциональный трей.
- Экспорт TXT, HTML и Markdown. Английский по умолчанию, полная русская локализация.

## Интерфейс

![Настоящий редактор, синтетический проект](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Editor.png)

| Настройки | Защита проекта |
|---|---|
| ![Настоящие настройки](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Settings.png) | ![Настоящая установка пароля](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Protection.png) |

[Заблокированный проект](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Locked.png) · [Social preview](https://github.com/Chatonaut/Nocturne_Notes/releases/download/v2.5.0/Nocturne-Notes-Social-Preview.png). Скриншоты настоящего Electron-приложения с синтетическими заметками, не макеты; ссылки на файлы 2.5.0 доступны после успешной публикации релиза.

## Технические особенности

HTML/CSS/JavaScript в Electron, изолированные renderer/preload, главный процесс Node, SQLite для обычных проектов, SQLCipher 4.20.0 Community и статический OpenSSL 3.6.5 для защищенных. Без дополнительного UI-фреймворка. Готовность нативного окна, восемь зон изменения размеров. Текущий маркер .ns — nocturne-notes-v1. Закрепленные зависимости, проверяемый IPC, CSP, целостность ASAR и усиленные fuses.

Интересные детали: независимый recovery через 450 мс; автосохранение 1–20 минут; 50 шагов undo на заметку и общий приблизительный лимит 64 МиБ; минимальное окно 740×480; палитра 35 цветов; компактные смещения поиска и ограничение подсветки без ограничения навигации. Итоговая проверка исходников — 86 модульных тестов и 60 сессий до 1000 заметок; синтетический CI не гарантирует скорость или полную безопасность. См. [контроль качества](docs/ru/07_QA_ACCEPTANCE.md).

## Конфиденциальность и FAQ

**Нужен интернет?** Нет аккаунта, облака или синхронизации. В стандартном сетевом тесте HTTP/WebSocket приложения не замечены; внешние ссылки и опциональные словари отдельно.

**Что защищает пароль?** Содержимое проекта, заголовки, корзину и защищенный recovery. Имена файлов, буфер обмена, открытый экспорт и прежние копии не защищены. Сброса пароля и безопасного стирания нет; делайте резервные копии.

**Можно переносить проект?** Закройте приложение, скопируйте .ns. Не редактируйте один проект из двух процессов.

**Удаление стирает заметки?** Установщик сохраняет проекты и настройки. У Portable отдельный профиль AppData.

## Горячие клавиши

| Клавиши | Действие |
|---|---|
| Ctrl+N / Ctrl+Shift+N | Новая заметка / проект |
| Ctrl+O / Ctrl+S | Открыть / сохранить |
| Ctrl+Shift+S | Сохранить как |
| Ctrl+F / Ctrl+H | Поиск / замена |
| Ctrl+Backslash | Боковая панель |
| Ctrl+Shift+L | Установить пароль / блокировать / разблокировать |
| F11 / Esc | Концентрация / выход |
| Ctrl+Shift+T | Поверх окон |

[Все клавиши и руководство](docs/ru/USER_GUIDE.md) · [Что нового](docs/ru/CHANGELOG.md) · [Документация](docs/ru/00_START_HERE.md) · [Сборка из исходников](docs/ru/06_BUILD_GITHUB.md) · [Формат и ограничения защиты](docs/ru/05_NS_FORMAT.md) · [Риски](docs/ru/10_RISKS_AND_DECISIONS.md)

MIT — [LICENSE](LICENSE). Уведомления и лицензии сторонних компонентов входят в Windows-сборку. Публичный workflow строит приложение независимо.

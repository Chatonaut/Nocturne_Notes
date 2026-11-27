<p align="center"><img src="assets/nocturne-brand-mark.png" width="116" alt="Nocturne Notes logo"></p>

<h1 align="center">Nocturne Notes</h1>
<p align="center"><strong>Минималистичный редактор заметок</strong></p>
<p align="center">Твои заметки. Твои файлы. Твоё рабочее пространство.</p>
<p align="center">Windows 11 x64 · 2.5.0 · Open source</p>

<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/Chatonaut/Nocturne_Notes?label=release"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml"><img alt="Windows build" src="https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml/badge.svg"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases"><img alt="downloads" src="https://img.shields.io/github/downloads/Chatonaut/Nocturne_Notes/total"></a>
  <a href="https://github.com/Chatonaut/Nocturne_Notes/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/Chatonaut/Nocturne_Notes?style=flat"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/github/license/Chatonaut/Nocturne_Notes"></a>
</p>

<p align="center">
  <a href="docs/ru/01_PASSPORT.md"><img alt="Windows 11 x64" src="https://img.shields.io/badge/Windows-11%20x64-336699"></a>
  <a href="docs/ru/04_ARCHITECTURE.md"><img alt="Electron" src="https://img.shields.io/badge/Electron-45.5.0-536878"></a>
  <a href="docs/ru/05_NS_FORMAT.md"><img alt="SQLCipher" src="https://img.shields.io/badge/SQLCipher-4.20.0-536878"></a>
  <a href="docs/ru/04_ARCHITECTURE.md"><img alt="OpenSSL" src="https://img.shields.io/badge/OpenSSL-3.6.5-536878"></a>
  <a href="docs/ru/05_NS_FORMAT.md"><img alt="Local files" src="https://img.shields.io/badge/Storage-local%20.ns-536878"></a>
  <a href="docs/ru/USER_GUIDE.md"><img alt="Languages" src="https://img.shields.io/badge/Languages-EN%20%7C%20RU-536878"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.ru.md">Русский</a></p>
<p align="center">
  <a href="https://github.com/Chatonaut/Nocturne_Notes/releases/latest"><strong>Скачать</strong></a> ·
  <a href="docs/ru/USER_GUIDE.md">Руководство</a> ·
  <a href="docs/ru/CHANGELOG.md">Что нового</a> ·
  <a href="docs/ru/00_START_HERE.md">Документация</a>
</p>

---

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

## Что нового в 2.5

| Возможность | Что изменилось |
|---|---|
| Защита проекта | SQLCipher, установка, смена и снятие пароля |
| Быстрая блокировка | Один замок для трех состояний; Ctrl+Shift+L |
| Черновики | Сохранение, отказ или отмена при выходе и смене проекта |
| Закрепление | Отдельная верхняя группа важных заметок |
| Надежность | Атомарные операции, проверенные копии, восстановление по идентификатору файла |
| Поиск и интерфейс | Живые результаты, компактное хранение совпадений, сохранение состояния панели |

[Полная история изменений →](docs/ru/CHANGELOG.md)

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

Итоговая проверка утвержденного кода включала 86 модульных тестов и 60 сессий до 1000 заметок. Все проверки прошли, но синтетические замеры не гарантируют производительность на другом оборудовании или полную безопасность. Независимая сборка проверяет реальные EXE, запуск Portable, установку/удаление, нативную библиотеку, аудит и контрольные суммы. [Контроль качества](docs/ru/07_QA_ACCEPTANCE.md).

## Nocturne Notes в цифрах

| Параметр | Значение |
|---|---|
| Системные шрифты | 7 |
| Палитра текста | 35 цветов |
| Размер основного текста | 10–35 px |
| Размер заголовка | 15–35 px |
| Межстрочный интервал | 1,0–2,0 |
| Автосохранение | 1–20 минут; по умолчанию 1 минута |
| Отдельная запись восстановления | После паузы ввода 450 мс |
| История Undo | До 50 шагов на заметку; общий приблизительный бюджет 64 МиБ |
| Максимальный заголовок | 250 символов |
| Максимальный HTML заметки | 5 000 000 символов |
| Минимальный размер окна | 740 × 480 |
| Экспорт | TXT · HTML · Markdown |

Ограничения относятся к текущему формату и механизму редактора; они не являются гарантиями одинаковой производительности на любом компьютере.

## Три состояния одного замка

| Состояние проекта | Нажатие замка или Ctrl+Shift+L |
|---|---|
| Обычный | Открывает установку пароля |
| Защищенный, открыт | Скрывает содержимое, сохраняет изменения и блокирует |
| Защищенный, заблокирован | Запрашивает пароль для разблокировки |

Пароль не хранится в настройках. Минимум — 8 кодовых точек Unicode; рекомендуется длинная уникальная парольная фраза. Сворачивание и трей не блокируют автоматически.

## Как устроен проект

Один файл .ns содержит заметки, их порядок, закрепления и корзину. Обычный проект использует SQLite; защищенный — SQLCipher. При открытом проекте возможен журнал SQLite, поэтому перед копированием или переносом закройте приложение. Защищенное восстановление хранится внутри базы; обычное — в локальном профиле.

[Формат проекта](docs/ru/05_NS_FORMAT.md) · [Риски и ограничения](docs/ru/10_RISKS_AND_DECISIONS.md)

## Конфиденциальность и FAQ

**Нужен интернет?** Нет аккаунта, облака или синхронизации. В стандартном сетевом тесте HTTP/WebSocket приложения не замечены; внешние ссылки и опциональные словари отдельно.

**Что защищает пароль?** Содержимое проекта, заголовки, корзину и защищенный recovery. Имена файлов, буфер обмена, открытый экспорт и прежние копии не защищены. Сброса пароля и безопасного стирания нет; делайте резервные копии.

**Можно переносить проект?** Закройте приложение, скопируйте .ns. Не редактируйте один проект из двух процессов.

**Удаление стирает заметки?** Установщик сохраняет проекты и настройки. У Portable отдельный профиль AppData.

## Первые шаги

1. Скачайте Setup или Portable из официального релиза.
2. Создайте первую заметку кнопкой + и сохраните проект в файл .ns.
3. При необходимости закрепите важную заметку и настройте типографику.
4. Для конфиденциальных записей установите пароль и сохраните резервную копию закрытого проекта.

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

## Для разработчиков

Исходный код и зависимости закреплены. Публичный workflow выполняет независимую Windows-сборку с SQLCipher, OpenSSL, проверками интерфейса, безопасности, упаковки и установщика. Отчеты аудита и SBOM формируются автоматически.

[Инструкция сборки](docs/ru/06_BUILD_GITHUB.md) · [Архитектура](docs/ru/04_ARCHITECTURE.md) · [Windows Actions](https://github.com/Chatonaut/Nocturne_Notes/actions/workflows/windows.yml) · [Сообщить об ошибке](https://github.com/Chatonaut/Nocturne_Notes/issues)

Не прикладывайте к отчетам реальные проекты, заметки, пароли или личные данные.

MIT — [LICENSE](LICENSE). Уведомления и лицензии сторонних компонентов входят в Windows-сборку. Публичный workflow строит приложение независимо.

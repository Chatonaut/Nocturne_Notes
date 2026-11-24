# Сборка и упаковка

Windows 11 x64 или Windows-раннер GitHub, Node.js 22, Python с Pillow 11.3.0 и pefile 2024.8.26. Фиксировать electron 45.4.1 и electron-builder 26.18.0.

```powershell
npm run verify:visual
npm ci --no-audit --no-fund
npm test
npm run test:ui
python -m pip install Pillow==11.3.0 pefile==2024.8.26
python scripts/prepare-windows-icon.py
npm run build:win
node scripts/verify-package.js
python scripts/verify-exe-icons.py assets/nocturne-notes-refined.ico 'dist/win-unpacked/Nocturne Notes.exe' 'dist/Nocturne Notes Portable.exe' 'dist/Nocturne Notes Setup 2.0.0.exe'
./scripts/test-installer.ps1
Get-FileHash -Algorithm SHA256 'dist/Nocturne Notes Portable.exe','dist/Nocturne Notes Setup 2.0.0.exe'
```

Тест установки изменяет ярлыки и профиль одноразового раннера: не запускать на рабочем компьютере с реальными заметками. Выходной каталог dist. EXE: Nocturne Notes Setup 2.0.0.exe и Nocturne Notes Portable.exe; контрольные суммы SHA256SUMS.txt. Явный список ASAR, два реальных языковых пакета en-US.pak и ru.pak; NSIS английский/русский. Цифровая подпись не настроена. Установка для пользователя, пошаговая, выбор каталога, ярлыки рабочего стола/«Пуск», регистрация .ns; удаление сохраняет данные. Обычный ICO неизменен, макрос NSIS меняет только «Пуск».

Публичный workflow собирает и тестирует снимок, публикует файлы GitHub Release с SHA-256. Приватная приемка включала три чередующихся прогона бенчмарка против 1.8.0; историческое сравнение требует отдельного checkout базовой версии и не повторяется из отсутствующей публичной истории. Результаты разных сборок могут побайтово отличаться; сверять SHA256SUMS именно скачанного релиза.

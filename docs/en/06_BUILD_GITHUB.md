# Build and packaging

Windows 11 x64 or Windows GitHub-hosted runner, Node.js 22, Python with Pillow 11.3.0 and pefile 2024.8.26. Keep electron 45.4.1 and electron-builder 26.18.0 locked.

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

Installer smoke test modifies a disposable runner's shortcuts and profile: do not run it on a normal workstation with real notes. The output directory is dist. Required EXEs: Nocturne Notes Setup 2.0.0.exe and Nocturne Notes Portable.exe; checksums SHA256SUMS.txt. Runtime ASAR allowlist, two actual locale packs en-US.pak and ru.pak; NSIS English/Russian. No digital signature configured. Installer is per-user, assisted, with selectable directory, desktop/Start Menu shortcuts and .ns registration; uninstall preserves data. Standard ICO unchanged, custom NSIS macro changes Start Menu only.

Public workflow builds and tests the snapshot, publishes GitHub Release assets with SHA-256. Private acceptance included the three alternating benchmark runs against 1.8.0; this historical comparison requires a separate baseline checkout and is not repeated from an absent public history. Build output can differ byte-for-byte between runs; compare SHA256SUMS for the specific downloaded release.

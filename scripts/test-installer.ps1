# Test an actual per-user install on the disposable Windows CI runner.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP) { throw 'Installer smoke test requires a disposable Windows CI runner' }
$manifest = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
$artifactName = $manifest.build.nsis.artifactName.Replace('${version}', [string]$manifest.version)
$setup = (Resolve-Path -LiteralPath (Join-Path 'dist' $artifactName)).Path
$folder = Join-Path $env:RUNNER_TEMP 'NocturneNotesReleaseSmoke'
$exe = Join-Path $folder 'Nocturne Notes.exe'
$uninstall = Join-Path $folder 'Uninstall Nocturne Notes.exe'
$start = Join-Path ([Environment]::GetFolderPath('Programs')) 'Nocturne Notes.lnk'
$desktop = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Nocturne Notes.lnk'
$icon = Join-Path $folder 'resources\nocturne-start-menu.ico'
function Run-Checked($file, $arguments) {
  $p = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "$file exited with $($p.ExitCode)" }
}
function IconPath($shortcut) {
  return (($shortcut.IconLocation -split ',')[0]).Trim('"')
}
if (!$env:APPDATA) { throw 'Missing APPDATA' }
$profile = Join-Path $env:APPDATA 'Nocturne Notes'
$project = Join-Path $env:RUNNER_TEMP 'Nocturne Notes Release Smoke.ns'
foreach ($existing in @($folder,$profile,$start,$desktop,$project)) {
  if (Test-Path -LiteralPath $existing) { throw "Refusing to overwrite existing resource: $existing" }
}
try {
  Run-Checked $setup "/S /D=$folder"
  foreach ($file in @($exe,$uninstall,$start,$desktop,$icon)) {
    if (!(Test-Path -LiteralPath $file)) { throw "Installed file missing: $file" }
  }
  $shell = New-Object -ComObject WScript.Shell
  $menuLink = $shell.CreateShortcut($start)
  $desktopLink = $shell.CreateShortcut($desktop)
  if ($menuLink.TargetPath -ne $exe -or (IconPath $menuLink) -ne $icon) { throw "Incorrect Start Menu shortcut: $($menuLink.TargetPath) $($menuLink.IconLocation)" }
  if ($desktopLink.TargetPath -ne $exe -or (IconPath $desktopLink) -ne $exe) { throw "Incorrect desktop shortcut: $($desktopLink.TargetPath) $($desktopLink.IconLocation)" }
  if ((Get-FileHash $icon).Hash -ne (Get-FileHash 'assets/nocturne-start-menu.ico').Hash) { throw 'Incorrect installed Start Menu icon bytes' }
  python scripts/verify-exe-icons.py assets/nocturne-notes-refined.ico $exe $uninstall
  if ($LASTEXITCODE -ne 0) { throw 'Installed executable icon check failed' }
  Write-Host 'PASS installed executable, Start Menu and desktop shortcut icons'
  $association = (Get-ItemProperty -LiteralPath 'Registry::HKEY_CURRENT_USER\Software\Classes\.ns' -ErrorAction Stop).'(default)'
  if (!$association) { throw 'Missing .ns file association' }
  $command = (Get-ItemProperty -LiteralPath "Registry::HKEY_CURRENT_USER\Software\Classes\$association\shell\open\command" -ErrorAction Stop).'(default)'
  if ($command -notlike "*$exe*") { throw "Incorrect .ns open command: $command" }
  Write-Host 'PASS .ns association'
  # Verify the installed application is the exact audited payload.
  foreach ($relative in @('Nocturne Notes.exe','resources\app.asar','resources\nocturne_cipher.node')) {
    if ((Get-FileHash -LiteralPath (Join-Path $folder $relative)).Hash -ne (Get-FileHash -LiteralPath (Join-Path 'dist/win-unpacked' $relative)).Hash) { throw "Installed payload differs: $relative" }
  }
  Run-Checked $exe '--nocturne-verify-native'
  Write-Host 'PASS installed payload and native encryption'
  # Open a disposable named project using the actual installed executable.
  node -e "const {newProject}=require('./storage');newProject(process.argv[1],[{title:'Synthetic installed project',html:'<p>Installer smoke test</p>'}]);" $project
  if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $project)) { throw 'Synthetic project creation failed' }
  $timing = Join-Path $profile 'startup-timing.json'
  $env:NOCTURNE_CI_STARTUP_TRACE = '1'
  $before = Get-Date
  $app = Start-Process -FilePath $exe -ArgumentList ('"' + $project + '"') -PassThru
  try {
    $ready = $false
    for ($i=0; $i -lt 60; $i++) {
      if ((Test-Path $timing) -and (Get-Item $timing).LastWriteTime -ge $before) { $ready=$true; break }
      if ($app.HasExited) { throw 'Installed application exited before ready' }
      Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Installed app did not report first frame' }
    $preferences = Join-Path $profile 'preferences.json'
    $prefs = Get-Content -LiteralPath $preferences -Raw | ConvertFrom-Json
    if ($prefs.lastProject -ne $project) { throw 'Installed application did not open the named project' }
    $app.Refresh()
    if ($app.MainWindowHandle -eq 0 -or !$app.CloseMainWindow() -or !$app.WaitForExit(15000)) { throw 'Installed application did not close normally' }
    Write-Host 'PASS installed application first frame and named project'
  } finally {
    Remove-Item Env:NOCTURNE_CI_STARTUP_TRACE -ErrorAction SilentlyContinue
    if (!$app.HasExited) { Stop-Process -Id $app.Id -Force }
  }
  $projectHash = (Get-FileHash -LiteralPath $project).Hash
  $prefsHash = (Get-FileHash -LiteralPath $preferences).Hash
  Run-Checked $uninstall '/S'
  for ($i=0; $i -lt 20 -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }
  foreach ($file in @($exe,$start,$desktop,$icon)) {
    if (Test-Path -LiteralPath $file) { throw "Uninstall left installed resource: $file" }
  }
  if (!(Test-Path (Join-Path $profile 'preferences.json'))) { throw 'Uninstall removed user preferences' }
  if ((Get-FileHash -LiteralPath $preferences).Hash -ne $prefsHash -or (Get-FileHash -LiteralPath $project).Hash -ne $projectHash) { throw 'Uninstall changed user preferences or named project' }
  Write-Host 'PASS uninstall preserves user data byte for byte'
} finally {
  if (Test-Path -LiteralPath $uninstall) { Start-Process -FilePath $uninstall -ArgumentList '/S' -Wait }
}

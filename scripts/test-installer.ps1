# Test an actual per-user install on the disposable Windows CI runner.
$ErrorActionPreference = 'Stop'
$setup = (Resolve-Path 'dist/Nocturne Notes Setup 2.0.0.exe').Path
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
  # Smoke-test the shipped app, not only the source renderer.
  $profile = Join-Path $env:APPDATA 'Nocturne Notes'
  $timing = Join-Path $profile 'startup-timing.json'
  $before = Get-Date
  $app = Start-Process -FilePath $exe -PassThru
  try {
    $ready = $false
    for ($i=0; $i -lt 60; $i++) {
      if ((Test-Path $timing) -and (Get-Item $timing).LastWriteTime -ge $before) { $ready=$true; break }
      if ($app.HasExited) { throw 'Installed application exited before ready' }
      Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Installed app did not report first frame' }
    $app.Refresh()
    if ($app.MainWindowHandle -ne 0) { [void]$app.CloseMainWindow(); [void]$app.WaitForExit(15000) }
    Write-Host 'PASS installed application first frame'
  } finally {
    if (!$app.HasExited) { Stop-Process -Id $app.Id -Force }
  }
  Run-Checked $uninstall '/S'
  for ($i=0; $i -lt 20 -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }
  foreach ($file in @($exe,$start,$desktop,$icon)) {
    if (Test-Path -LiteralPath $file) { throw "Uninstall left installed resource: $file" }
  }
  if (!(Test-Path (Join-Path $profile 'preferences.json'))) { throw 'Uninstall removed user preferences' }
  Write-Host 'PASS uninstall preserves user data'
} finally {
  if (Test-Path -LiteralPath $uninstall) { Start-Process -FilePath $uninstall -ArgumentList '/S' -Wait }
}

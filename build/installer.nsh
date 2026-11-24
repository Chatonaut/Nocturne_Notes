; Only the Start Menu shortcut uses the larger artwork.
; Keep electron-builder's normal application, desktop, installer, and uninstall icons.
!macro customInstall
  SetOutPath "$INSTDIR\resources"
  File /oname=nocturne-start-menu.ico "${PROJECT_DIR}\assets\nocturne-start-menu.ico"
  SetOutPath "$INSTDIR"
  ${If} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\nocturne-start-menu.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${EndIf}
!macroend
!macro customUnInstall
  Delete "$INSTDIR\resources\nocturne-start-menu.ico"
!macroend

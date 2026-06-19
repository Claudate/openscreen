!macro NSIS_HOOK_PREINSTALL
  DeleteRegKey HKCU "Software\Classes\cap-desktop"
  DeleteRegKey HKCU "Software\Classes\Cap Project"
  DeleteRegValue HKCU "Software\Classes\.cap" ""
  DeleteRegKey HKLM "Software\Classes\cap-desktop"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  SetOutPath "$INSTDIR"
  IfFileExists "$INSTDIR\resources\windows-runtime\avdevice-61.dll" 0 +3
    CopyFiles /SILENT "$INSTDIR\resources\windows-runtime\*.dll" "$INSTDIR\"
  IfFileExists "$INSTDIR\avdevice-61.dll" +2 0
    MessageBox MB_ICONEXCLAMATION "Reko runtime DLLs were not installed correctly. Please use the portable ZIP build or reinstall." /SD IDOK
!macroend

!macro preInit
  ; This macro is inserted at the beginning of the NSIS .OnInit callback
  ; Check Windows version and enforce minimum Windows 10 requirement
  ${If} ${AtLeastWin10}
    ; Windows 10 or later - continue with installation
    Goto continue_install
  ${Else}
      MessageBox MB_OK|MB_ICONSTOP "This application requires Windows 10 or later.$\r$\n$\r$\nYour Windows version is not supported.$\r$\n$\r$\nPlease upgrade to Windows 10 or later to continue."
      Abort "Windows version requirement not met"
  ${EndIf}

  continue_install:
  ; Continue with normal installation process
!macroend

!ifndef BUILD_UNINSTALLER
  Function AddToStartup
    CreateShortCut "$SMSTARTUP\Session.lnk" "$INSTDIR\Session.exe" ""
  FunctionEnd

  ; Using the readme setting as an easy way to add an add to startup option
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Start Session when Windows starts"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION AddToStartup
!endif

!macro customUnInstall
  ; Custom uninstall macro
  ; This runs during the uninstallation process
  Delete "$SMSTARTUP\Session.lnk"
!macroend

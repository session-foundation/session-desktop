!macro customHeader
  ; Custom header macro - called at the beginning of the installer
!macroend

!macro preInit
  ; This macro is inserted at the beginning of the NSIS .OnInit callback
  ; Check Windows version and enforce minimum Windows 10 requirement
  
  ; Get Windows version using a more reliable method
  ${If} ${AtLeastWin10}
    ; Windows 10 or later - continue with installation
    Goto continue_install
  ${Else}
    ; Check if it's Windows 8.1 or earlier
    ${If} ${AtLeastWin8.1}
      ; Windows 8.1 - show error and abort
      MessageBox MB_OK|MB_ICONSTOP "This application requires Windows 10 or later.$\r$\n$\r$\nWindows 8.1 is not supported.$\r$\n$\r$\nPlease upgrade to Windows 10 or later to continue."
      Abort "Windows version requirement not met"
    ${Else}
      ; Windows 8 or earlier - show error and abort
      MessageBox MB_OK|MB_ICONSTOP "This application requires Windows 10 or later.$\r$\n$\r$\nYour Windows version is not supported.$\r$\n$\r$\nPlease upgrade to Windows 10 or later to continue."
      Abort "Windows version requirement not met"
    ${EndIf}
  ${EndIf}
  
  continue_install:
  ; Continue with normal installation process
!macroend

!macro customInit
  ; Custom initialization macro
  ; This runs after preInit and can be used for additional setup
!macroend

!macro customInstall
  ; Custom installation macro
  ; This runs during the installation process
  ; Only run for fresh installs, not updates
  ${ifNot} ${isUpdated}
    ; This code only runs for fresh installations
    ; Basic installation logic can be added here
  ${endIf}
!macroend

!macro customInstallMode
  ; Custom install mode macro
  ; Can be used to set $isForceMachineInstall or $isForceCurrentInstall
  ; to enforce one or the other modes
!macroend

!macro customWelcomePage
  ; Custom welcome page macro
  ; Welcome Page is not added by default for installer
  ; Uncomment the line below if you want to add a custom welcome page
  ; !insertMacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  ; Custom uninstaller welcome page macro
  ; Uncomment and customize if you want a custom uninstaller welcome page
  ; !define MUI_WELCOMEPAGE_TITLE "Uninstall Session Desktop"
  ; !define MUI_WELCOMEPAGE_TEXT "This will remove Session Desktop from your computer.$\r$\n$\r$\nClick Uninstall to continue."
  ; !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUnInstallSection
  ; Custom uninstall section macro
  ; You can add some uninstall section as component page
  ; If defined, then always run after `customUnInstall`
  ; Section /o "un.Some cool checkbox"
  ;   ; Add custom uninstall options here if needed
  ; SectionEnd
!macroend

!macro customUnInit
  ; Custom uninstaller initialization macro
  ; This runs when the uninstaller starts
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

!macro customRemoveFiles
  ; Custom remove files macro
  ; This runs when removing files during uninstallation
!macroend

; ========================================
; CUSTOM COMPONENTS SECTIONS
; ========================================

!macro customComponents
  ; Add custom components page with checkboxes
  !insertMacro MUI_PAGE_COMPONENTS
!macroend

; Simple checkbox sections
Section "Startup" StartupSection
  SetOutPath "$INSTDIR"
SectionEnd

Section "Taskbar" TaskbarSection
  SetOutPath "$INSTDIR"
SectionEnd

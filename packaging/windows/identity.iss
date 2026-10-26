; Configuración por aplicación de Prisma. Mantener MyAppId estable entre versiones.
; Copia local de la plantilla compartida "Biglex Modern 2.0" (read-only para el agente).
#ifndef MyAppName
  #define MyAppName "Prisma"
#endif
#ifndef MyAppId
  ; Identidad de actualización de Prisma. Estable entre versiones: una versión
  ; nueva actualiza la anterior en lugar de crear una instalación paralela.
  ; Las llaves se escapan con {{ en el preprocesador de Inno Setup.
  #define MyAppId "{{9F3C5A7E-4D2B-4E6F-9A1C-8B5D3E2F7A04}"
#endif
#ifndef MyAppDirectory
  #define MyAppDirectory "Prisma"
#endif
#ifndef MyAppExe
  #define MyAppExe "prisma.exe"
#endif
#ifndef MyAppIcon
  #define MyAppIcon "icon.ico"
#endif
#ifndef MyAppTheme
  ; dynamic = claro/oscuro automático según el tema de Windows.
  #define MyAppTheme "dynamic"
#endif

#ifndef MyAppSubtitle
  #define MyAppSubtitle "Tu espacio de música, vídeos e imágenes."
#endif

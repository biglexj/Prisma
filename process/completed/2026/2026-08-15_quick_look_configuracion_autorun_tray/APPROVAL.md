# Aprobación: Configuración de Atajos, Autorun y Bandeja del Sistema (System Tray)

- **Fecha de Conclusión**: 2026-08-15
- **Responsable**: biglexj
- **Estado**: `APPROVED`
- **Decisión**: Aprobado e integrado al 10,000 millones por ciento.

## Decisiones y Alcance
- [x] Selector de atajos en Configuración (`Espacio`, `Ctrl + Espacio`, `Alt + Espacio`, `Shift + Espacio`, `Desactivado`).
- [x] Soporte para System Tray en Tauri v2 con icono en la bandeja del sistema y menú contextual.
- [x] Persistencia de proceso residente al cerrar (`Minimizar a la bandeja al cerrar`).
- [x] Inicio automático con Windows (Autorun) mediante registro `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- [x] Flag `--autostart` para arranque silencioso en la bandeja.
- [x] UI integrada en `AppSettings.tsx` con diseño Material 3 Expressive.

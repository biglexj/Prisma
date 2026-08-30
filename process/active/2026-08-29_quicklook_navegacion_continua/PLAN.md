# Plan: Navegación Continua y Apertura No Invasiva en Quick Look

- Fecha: `2026-08-29`
- Responsable: `biglexj`
- Estado: `IMPLEMENTED_V1.0.6_PREPARED`
- Versión objetivo: `1.0.6`

## Objetivo
Implementar la apertura no invasiva (`SW_SHOWNOACTIVATE`) en Prisma Quick Look y el soporte fluido de navegación continua mediante teclas de flechas (`←`, `→`, `↑`, `↓`, `Inicio`, `Fin`, `RePág`, `AvPág`) sin pérdida de foco en el Explorador de Windows, sincronizando el versionado del proyecto a `1.0.6`.

## Alcance
1. Apertura sin robar el foco activo del Explorador de Windows en `service.rs`.
2. Detección y canalización de teclas de navegación en `keyboard_hook.rs`.
3. Persistencia atómica del `HWND` de Explorer y soporte de carpetas en `shell_selection.rs`.
4. Prevención de scroll WebView en `QuickLookWindow.tsx`.
5. Actualización de versión a `1.0.6` en `package.json`, `Cargo.toml`, `tauri.conf.json`, `version.ts`, `RELEASE_NOTES.md`, `RELEASE_MESSAGE.md` y `ROADMAP.md`.

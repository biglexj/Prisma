# Tareas: Navegación Continua y Capacidades Avanzadas de Quick Look (v1.0.6)

- [x] Adaptar `service.rs` para mostrar la ventana sin activar (`SW_SHOWNOACTIVATE`) ni robar foco.
- [x] Implementar sondeo adaptativo de selección en `service.rs` (35ms, 80ms, 150ms).
- [x] Interceptar teclas de navegación (`←`, `→`, `↑`, `↓`, `Inicio`, `Fin`, `RePág`, `AvPág`) en `keyboard_hook.rs`.
- [x] Implementar reenvío de teclas y persistencia de `LAST_EXPLORER_HWND` con `AtomicIsize` en `shell_selection.rs`.
- [x] Soportar carpetas en `shell_item_to_path` mediante `path.exists()`.
- [x] Prevenir scroll WebView en `QuickLookWindow.tsx`.
- [x] Corregir cierre con Barra Espaciadora (`VK_SPACE`) suprimiendo la tarjeta residual y ocultando la ventana vía `ShowWindow(SW_HIDE)`.
- [x] Recentrar continuamente la ventana QuickLook (`window.center()`) ante cualquier cambio de dimensiones o formato.
- [x] **Propuesta 1 (Archivos Comprimidos)**: Inspección nativa de `.zip`, `.7z`, `.rar`, desglose de archivos internos, estadísticas y visor en `QuickLookArchive.tsx`.
- [x] **Propuesta 2 (Inspector EXIF)**: Extracción nativa de metadata de cámara (ISO, apertura, obturador, lente) y popover flotante en `QuickLookHeader.tsx`.
- [x] **Propuesta 3 (Libros EPUB)**: Extracción de portada HD, sinopsis, autor y capítulos, con visor de libro 3D en `QuickLookEpub.tsx`.
- [x] **Propuesta 4 (Selección Múltiple en Explorer)**: Extracción de lotes en `shell_selection.rs`, paginador interactivo `[ ‹ ] X / Y [ › ]` y comando `quick_look_step_selection`.
- [x] **Propuesta 5 (Sinergia Aurora y Acciones Rápidas)**: Copia rápida de ruta con feedback visual y accesos directos contextuales.
- [x] Modularizar CSS en `quick-look-archive.css`, `quick-look-epub.css` y `quick-look-exif.css`.
- [x] Incrementar versión a `1.0.6` en `package.json`, `Cargo.toml`, `tauri.conf.json` y `version.ts`.
- [x] Actualizar `RELEASE_NOTES.md`, `RELEASE_MESSAGE.md` y `ROADMAP.md`.
- [x] Validar compilación con `cargo check`, `bun run check` y `cargo test` (24/24 tests pasando).

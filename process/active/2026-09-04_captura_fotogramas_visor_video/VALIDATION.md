# Captura de Fotogramas en Visor de Vídeo (Snapshot estilo VLC) y Configuración de Assets — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobar que `media_get_default_pictures_dir` y `video_save_snapshot` compilan y están registrados en Tauri. Esperado: compilación exitosa.
- [x] V02 — Agente — Soporte para formatos PNG, WebP y JPEG en Rust y Frontend. Esperado: decodificación y escritura correcta con extensiones y mimes correspondientes.
- [x] V03 — Agente — Verificar en `useSystemSettings` la persistencia de `videoSnapshotFolder` y `videoSnapshotFormat` con sincronización `localStorage` y eventos entre ventanas. Esperado: estado reactivo sincronizado.
- [x] V04 — Agente — Probar selector de carpeta en `AppSettings` con diálogo de Tauri y verificar botón de restablecer a Imágenes y chips de formato. Esperado: UI integrada con tokens Material 3.
- [x] V05 — Agente — Comprobar controles en `VideoPlayer` con botón de cámara, botones `-1f` / `+1f`, `VideoToolsMenu`, menú contextual y atajos (`Shift + S`, `E`, `Shift + E`, `,`, `.`). Esperado: destello visual, guardado en disco y toast flotante con miniatura.
- [x] V06 — Agente — Ejecutar `bun run compile:check` (`tsc --noEmit`) para validar tipado estricto. Esperado: 0 errores (verificado).
- [x] V07 — Agente — Ejecutar `cargo check` en `src-tauri`. Esperado: compilación exitosa sin errores (verificado en 0.57s).
- [x] V08 — Agente — Validar mitigación de Tainted Canvas en `<video>` mediante `crossOrigin="anonymous"` y reporte de errores en toast. Esperado: exportación de fotogramas sin SecurityError.
- [x] V09 — Agente — Validar atajos `F` (avanzar 1 fotograma) y `Shift + F` (retroceder 1 fotograma) junto con `F11` / `Alt + Enter` para pantalla completa. Esperado: atajos reactivos documentados en `AppSettings.tsx`.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.

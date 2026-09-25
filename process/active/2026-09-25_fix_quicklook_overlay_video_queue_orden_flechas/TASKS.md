# Tareas: Corrección de Superposición Quick Look, Centrado de Ventana, Resguardo de Cola de Música y Navegación Natural de Vídeos e Imágenes

- [x] 1. Backend Rust: Restaurar `always_on_top` permanente y `HWND_TOPMOST` para Quick Look en `src-tauri/src/features/quick_look/service.rs`.
- [x] 2. Backend Rust: Refinar `is_foreground_quicklook()` para validar el HWND de la ventana Quick Look.
- [x] 3. Backend Rust: Implementar comando `visual_library_scan_folder_items` en `visual_library.rs` y registrar en `lib.rs`.
- [x] 4. Backend Rust: Recentrar siempre la ventana de Quick Look en `service.rs` (tanto en `show_file_path_with_selection` como en `handle_selection_update`) y en `quick_look_set_size` si no está fijada (`!is_pinned`). Excluir `"quicklook"` de `tauri_plugin_window_state` con `.with_denylist(&["quicklook"])` y `.skip_initial_state("quicklook")`.
- [x] 5. Frontend App: Reemplazar `playback.toggle()` por `playback.pause()` y proteger contra reanudación no deseada en `src/app/App.tsx`.
- [x] 6. Frontend App & Visual: Implementar servicio de resolución de cola relativa para vídeos e imágenes (`visualSessionResolver.ts`) preservando orden natural e índice exacto.
- [x] 7. Frontend Visual: Encolar elementos relativos en `VisualLibrary.tsx` (línea de tiempo, vista de carpetas y selección externa).
- [x] 8. Frontend Visual: Adaptar controles de teclado en `VideoPlayer.tsx` para navegación con flechas (`ArrowLeft` / `ArrowRight` para vídeo anterior/siguiente) y saltos temporales de 10s con `Shift`/`Ctrl` o teclas `J`/`L`.
- [x] 9. Frontend Visual: Implementar navegación circular continua (wrap-around) en `VideoPlayer.tsx` (del último al primero y viceversa).
- [x] 13. Frontend UI: Rediseñar y optimizar panel de atajos de teclado (`ShortcutsSettingsPanel.tsx`) con Masonry columns, chips de categoría y búsqueda en tiempo real, reduciendo `AppSettings.tsx`.
- [x] 14. Backend Rust: Emitir `"prisma://window-close-requested"` en `WindowEvent::CloseRequested` de la ventana principal antes de ocultar a la bandeja en `lib.rs`.
- [x] 15. Frontend App: Escuchar `"prisma://window-close-requested"` en `App.tsx` para pausar el reproductor de vídeo inmediatamente al cerrar con la "X", preservando la reproducción en segundo plano solo para música.
- [x] 16. Frontend Atajos: Implementar atajo dedicado `Shift + B` / `H` para minimizar a segundo plano ("escuchar de fondo") sin pausar el vídeo, y registrar en `ShortcutsSettingsPanel.tsx`.
- [x] 17. Frontend UI: Crear componente `VolumeOsd.tsx` y estilos CSS con animación de ondas de sonido dinámicas crecientes (`)))`), indicador numérico y micro-barra de progreso para vídeo y música.
- [x] 18. Frontend Visual: Integrar `VolumeOsd` en `VideoPlayer.tsx` disparado por atajos `↑`/`↓` y `+`/`-`/`M`, manteniendo ocultos los controles inferiores de reproducción.
- [x] 19. Verificación de compilación (`cargo check` y `bun run build`).

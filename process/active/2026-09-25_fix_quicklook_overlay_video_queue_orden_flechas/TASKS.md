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
- [x] 10. Frontend Visual: Unificar la tecla `F` en `VideoPlayer.tsx` para alternar Pantalla Completa (Fullscreen) al igual que en `ImageViewer.tsx`, reubicando el paso de fotograma a `E`/`Shift+E` y `,`/`.`.
- [x] 11. Verificación de compilación (`cargo check` y `bun run build`).
- [x] 12. Validación integral y registro de resultados en `VALIDATION.md`.

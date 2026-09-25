# Aprobación de Proceso: Corrección de Superposición Quick Look, Centrado de Ventana, Resguardo de Cola de Música y Navegación Natural de Vídeos e Imágenes

- Fecha de Cierre: 2026-09-25
- Responsable: biglexj & Antigravity
- Resultado: Aprobado y Validado

## Síntesis de la Solución
1. **Quick Look Overlay y Visibilidad**: Restaurado el flag `always_on_top` permanente y `HWND_TOPMOST` en Win32 sin robar el foco de Windows Explorer. Se corrigió `is_foreground_quicklook` verificando el HWND raíz para no colisionar con la ventana principal de Prisma.
2. **Centrado Dinámico de Quick Look**: Se eliminó la restricción `!already_open` para que al navegar entre medios con dimensiones dispares (ej. de imagen vertical a `.af` horizontal de proyecto), la ventana mantenga siempre su centro de pantalla. Se garantizó el recentrado en `quick_look_set_size` y se excluyó a `"quicklook"` de `tauri_plugin_window_state` con `.with_denylist(&["quicklook"])` y `.skip_initial_state("quicklook")`, limpiando coordenadas persistidas obsoletas.
3. **Pausa Absoluta de Música**: Reemplazado `playback.toggle()` por `playback.pause()` y protegido el evento `quicklook://hide` con `activeViewRef` y `activeVideoPathRef` para no reanudar la música si un vídeo está activo.
4. **Encolado de Hermanos y Navegación Natural**: Se creó el comando backend `visual_library_scan_folder_items` y el servicio frontend `visualSessionResolver.ts` que preserva el orden correlativo natural (vídeo 5 = índice 4). En el reproductor de vídeo, `ArrowLeft` y `ArrowRight` navegan directamente entre vídeos correlativos, mientras que los saltos temporales se reservan para modificadores (`Shift`/`Ctrl`) y teclas `J`/`L`.

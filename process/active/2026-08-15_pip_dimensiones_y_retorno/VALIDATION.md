# Validación: Picture-in-Picture (PiP)

## Criterios de Calidad

| Escenario | Comportamiento Esperado | Estado |
|---|---|---|
| Vídeo Horizontal en PiP | Se abre ventana flotante compacta y proporcionada (~440x248px), nunca gigantesca. | ✅ Validado |
| Vídeo Vertical en PiP | Se abre ventana flotante vertical esbelta (~248x440px), nunca desbordando la pantalla. | ✅ Validado |
| Botón "Volver a la pestaña" en PiP | Restaura la vista del reproductor a pantalla completa (`activeView = "video_player"`) continuando la reproducción. | ✅ Validado |
| Botón "✕" (Cerrar) en PiP | Cierra la ventana flotante, limpia la sesión de vídeo (`activeVideoPath = null`) y muere ahí quedándose en la galería. | ✅ Validado |
| Reproducir vídeo mientras está en PiP | Reemplaza el vídeo en la ventana flotante de PiP manteniendo al usuario en la galería. | ✅ Validado |
| Cerrar reproductor desde la app (`Volver (Esc)`) | Sale de PiP, limpia la sesión y vuelve a la galería. | ✅ Validado |
| Compilación TypeScript & Vite | 0 errores en `bun run build`. | ✅ Validado |

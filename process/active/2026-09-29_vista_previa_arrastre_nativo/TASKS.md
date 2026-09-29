# Tareas

- [x] Identificar el icono actual y las miniaturas de las tarjetas.
- [x] Generar un PNG de arrastre desde la vista visible y un respaldo por tipo de archivo.
- [x] Usar la imagen actual en los visores que arrastran desde el título o botón.
- [x] Evitar que una soltada interna intente cargar el archivo como carpeta.
- [x] Comprobar compilación y formato PNG.
- [x] Revisar el informe de Biglex: el archivo se suelta bien, pero Windows no muestra la miniatura.
- [x] Corregir el bitmap nativo para conservar el canal alfa (CLR_INVALID) y ubicarlo junto al cursor.
- [x] Ajustar siluetas y proporciones exactas:
  - Música: Siempre cuadrada (1:1 / 184 × 184).
  - Vídeos e Imágenes: Panorámica (16:9 / 224 × 126), Vertical (9:16 / 126 × 224) o Cuadrada (1:1 / 184 × 184).
- [x] Implementar escalado cover centrado con recorte redondeado interior (evita barras negras y maximiza visibilidad).
- [x] Agregar distintivo visual sutil (badge Play en vídeos, badge musical en pistas).
- [x] Incorporar `crossOrigin="anonymous"` en etiquetas `<img>` (`VisualThumbnail`, `VideoThumbnail`, `MusicArtwork`, `ImageViewer`) para impedir canvas tainting.
- [x] Eliminar selector inexistente `.video-stage-surface` en `VideoPlayer.tsx`.
- [x] Actualizar pruebas unitarias en `test/nativeDragPreview.test.ts` (4 pruebas, 19 aserciones superadas).
- [x] Verificar tipado con `bun run check` (0 errores).
- [ ] Verificar visualmente el arrastre real de imagen, música y vídeo hacia Windows u otra aplicación.

# Metadatos Técnicos y Marcado de Tomas de Vídeo (Workflow DaVinci) — Plan

- Estado: `APPROVED`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Implementar una ficha técnica HUD de cámara, códec, fps reales y perfil de color en el reproductor de vídeo, junto con un sistema ágil de marcado de tomas (*Good Take*, *Descarte*, *B-Roll*, colores de clip estilo DaVinci Resolve) con atajos de teclado numéricos y filtros inmediatos en la galería visual.

## Alcance

- Incluye:
  - Backend Rust: Extracción profunda de metadatos técnicos de vídeo con `ffprobe` (resolución exacta, fps en punto flotante/fracción, códec de vídeo y audio, tasa de bits, espacio de color, transfer/gamma, primarios y metadatos de cámara si existen).
  - Backend Rust: Repositorio persistente local-first para marcadores de tomas (`video_takes.json` en AppData de Prisma) con operaciones atómicas de lectura, asignación y consulta masiva.
  - Frontend HUD: Componente `VideoTechnicalHud` en `VideoPlayer.tsx` desplegable u overlay ergonómico con badges tonales Material 3 Expressive (4K/1080p, 23.976/60 fps, ProRes/HEVC/H264, BT.709/BT.2020/HLG/PQ/Log).
  - Frontend Marcado Rápido: Componente `VideoTakeClassificationBar` y atajos de teclado de un toque (`1` = Buena Toma, `2` = Descarte, `3` = B-Roll, `0` = Limpiar), más selector de color de clip DaVinci (Naranja, Amarillo, Verde Lima, Azul Cian, Violeta, etc.).
  - Frontend Galería: Filtro rápido por tomas en `VisualLibrary.tsx` y micro-insignias tonales en las tarjetas de vídeo.
- No incluye:
  - Reconocimiento facial por IA pesado ni dependencias neuronales que ralenticen el inicio o consuman VRAM.
  - Edición no-lineal (NLE) de vídeo o transcodificación pesada obligatoria.

## Enfoque

1. **Backend Técnico (`src-tauri`)**:
   - Crear comando `video_get_technical_metadata(path)` en Rust aprovechando el binario `ffprobe` integrado.
   - Crear infraestructura `video_takes` con estructura de datos `VideoTakeMarker { status, clip_color, rating, note, updated_at }` y comandos Tauri correspondientes.
2. **Componentes UI de Vídeo (`src/features/visual_library/ui/components`)**:
   - Crear `VideoTechnicalHud.tsx` con diseño Material 3 Expressive, visualización limpia de badges técnicos y telemetría de archivo.
   - Integrar barra y atajos de marcado en `VideoPlayer.tsx` con retroalimentación visual inmediata (animaciones elásticas, feedback de estado y tooltips informativos).
3. **Integración con Galería Visual (`VisualLibrary.tsx`)**:
   - Añadir chip-filters para clasificación de tomas (*Todas*, *Buenas Tomas*, *Descartes*, *B-Roll*).
   - Mostrar indicador cromático/badge en las tarjetas de vídeo para identificación a simple vista.

## Criterios de finalización

- [ ] `ffprobe` extrae resolución, fps reales, códec, bitrate y perfil de color con latencia mínima (< 150ms).
- [ ] Atajos `1`, `2`, `3`, `0` asignan y persisten el estado de la toma al instante mientras se reproduce o pausa el vídeo.
- [ ] La ficha técnica HUD se despliega fluidamente con diseño Material 3 Expressive sin interferir con la barra de transporte o controles del reproductor.
- [ ] La galería visual permite filtrar vídeos por estado de toma con rendimiento fluido.
- [ ] Todos los tests de Rust y chequeo de tipos TypeScript pasan al 10,0% sin errores.

## Autorización

- [x] Plan aprobado para ejecución.

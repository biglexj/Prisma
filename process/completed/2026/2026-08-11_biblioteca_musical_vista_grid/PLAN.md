# Plan: Implementación de Vista de Biblioteca Musical (Música vs Escuchar)

## Contexto & Objetivo
Actualmente, al hacer clic en **Música** (debajo de `BIBLIOTECA` en la barra lateral), se renderizaba directamente la pantalla de reproducción activa (**Escuchar**). El usuario ha solicitado que la sección **Música** de la Biblioteca funcione y se visualice igual que **Imágenes** y **Vídeos**: una vista de biblioteca organizada en **Línea de tiempo (por fecha)** y **Carpetas**, con portadas/carátulas (`MusicArtwork`), títulos, carpetas relativas, tamaño de archivo y botones de administración de fuentes.

## Cambios Propuestos

### 1. Backend Rust (`src-tauri`)
- **[MODIFY] [model.rs](file:///d:/Proyectos/biglexj/Prisma/src-tauri/src/features/music_library/model.rs)**: Añadir `modified_at_millis: u128` y `size_bytes: u64` a la estructura `MusicLibraryItem`.
- **[MODIFY] [scanner.rs](file:///d:/Proyectos/biglexj/Prisma/src-tauri/src/features/music_library/scanner.rs)**: Extraer la fecha de modificación y tamaño de archivo de las pistas durante el escaneo.

### 2. Frontend (`src/features/music_library` & `src/app`)
- **[MODIFY] [types.ts](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/model/types.ts)**: Actualizar la interfaz `MusicLibraryItem` con `modifiedAtMillis` y `sizeBytes`.
- **[NEW] [MusicLibrary.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/MusicLibrary.tsx)**: Componente de vista principal para la biblioteca de música con selector de vista (Línea de tiempo / Carpetas), badges de resumen (canciones, carpetas, escaneo bajo demanda), Bento Grid / tarjetas de pistas con carátula y reproducción al clic.
- **[MODIFY] [music-library.css](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/music-library.css)**: Estilos CSS para el layout de la biblioteca musical, tarjetas, badge de play, vista vacía y grilla responsiva.
- **[MODIFY] [AppSidebar.tsx](file:///d:/Proyectos/biglexj/Prisma/src/app/ui/AppSidebar.tsx)**: Agregar `"music"` a `AppView` y vincular el elemento de navegación `Música` de `BIBLIOTECA` a `view: "music"` (conservando `Escuchar` en `PRINCIPAL` para `player`).
- **[MODIFY] [App.tsx](file:///d:/Proyectos/biglexj/Prisma/src/app/App.tsx)**: Agregar soporte para la vista `music`, renderizando `<MusicLibrary />` con las propiedades de `useMusicLibrary` y delegando `onPlay` al controlador de reproducción.

## Plan de Verificación

### Pruebas Automatizadas
- Ejecutar `bun run typecheck` / `tsc --noEmit` para validar tipos de TypeScript.
- Ejecutar `cargo test --manifest-path src-tauri/Cargo.toml` para verificar tests del scanner Rust.

### Verificación Manual
- Navegar a **Escuchar** bajo `PRINCIPAL`: comprobar que muestra la pantalla del reproductor activo (`PlaybackPreview`).
- Navegar a **Música** bajo `BIBLIOTECA`: comprobar que despliega la biblioteca visual de música con línea de tiempo, carpetas, carátulas y metadatos.
- Hacer clic en una tarjeta de música para iniciar la reproducción y verificar que la música suena correctamente.

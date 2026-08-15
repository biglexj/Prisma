# Tareas: Vista de Biblioteca Musical (Música vs Escuchar)

- [x] **Fase 1: Backend Rust & Modelo de Datos**
  - [x] Actualizar `MusicLibraryItem` en `src-tauri/src/features/music_library/model.rs` con `modified_at_millis` y `size_bytes`.
  - [x] Actualizar el scanner en `src-tauri/src/features/music_library/scanner.rs` para extraer metadatos de archivos de audio.
  - [x] Ejecutar `cargo check --manifest-path src-tauri/Cargo.toml --features mpv` para validar el scanner.

- [x] **Fase 2: Interfaz de Usuario y Componente MusicLibrary**
  - [x] Actualizar `MusicLibraryItem` en `src/features/music_library/model/types.ts`.
  - [x] Crear el componente `src/features/music_library/ui/MusicLibrary.tsx` con Bento Grid, portadas (`MusicArtwork`), agrupamiento por línea de tiempo/carpetas y reproductor al clic.
  - [x] Actualizar `src/features/music_library/ui/music-library.css` con estilos refinados para la biblioteca de música.

- [x] **Fase 3: Enrutamiento y Navegación**
  - [x] Actualizar `src/app/ui/AppSidebar.tsx` para desligar `Música` de `player` y vincularlo a la nueva vista `music`.
  - [x] Actualizar `src/app/App.tsx` para renderizar `<MusicLibrary />` cuando `activeView === "music"`.

- [x] **Fase 4: Validación y Compilación**
  - [x] Ejecutar comprobación de tipos `bun run check`.
  - [x] Validar navegación entre **Escuchar** (reproductor) y **Música** (biblioteca grid).

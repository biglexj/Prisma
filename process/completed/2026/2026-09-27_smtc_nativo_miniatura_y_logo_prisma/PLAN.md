# Plan: Integración SMTC Nativa de Windows — Carátula de Álbum y Logo/Identidad de Prisma

## Contexto y Diagnóstico
En la versión actual, el flyout de volumen y controles multimedia de Windows (SMTC) presentaba dos problemas señalados directamente por el usuario:
1. **Falta de miniatura/carátula**: En lugar de mostrar la portada de la canción reproduciéndose (ej. *Orquesta La Bella Luz - Y Qué Pasó*), Windows SMTC mostraba un icono genérico de nota musical. Esto ocurría porque Chromium/WebView2 rechaza o no interpreta URIs `data:image/...;base64` para el display updater de Windows SMTC al ser un componente nativo del sistema operativo que exige referencias a archivos o URIs resolubles por el sistema.
2. **Logo y nombre ajenos ("Microsoft Edge WebView2")**: En la esquina inferior derecha del flyout de volumen de Windows, aparecía el icono de Microsoft Edge con el texto `Microsoft Edge WebView2`. Esto se debía a que para sincronizar libmpv se utilizaba un elemento `<audio>` silencioso dentro de WebView2 que activaba la API web `navigator.mediaSession`, la cual en Chromium registra la sesión SMTC bajo el ejecutable de tiempo de ejecución `msedgewebview2.exe` en lugar de la aplicación anfitriona `prisma.exe`.

## Objetivos
1. **Módulo Nativo de SMTC en Rust (`infrastructure::media::smtc`)**:
   - Implementar `NativeSmtcManager` usando `ISystemMediaTransportControlsInterop::GetForWindow(HWND)` sobre la ventana Win32 de Prisma.
   - De esta forma, Windows asocia de forma 100% nativa la sesión multimedia a `prisma.exe`, mostrando el **icono oficial de Prisma** y el nombre **"Prisma"**, erradicando el logo de WebView2.
   - Extraer la carátula real del archivo musical en reproducción mediante `load_music_artwork_raw_bytes` y cargarla en el `DisplayUpdater` a través de `StorageFile` y `RandomAccessStreamReference::CreateFromFile`.
   - Capturar eventos de botones multimedia de hardware (`Play`, `Pause`, `Stop`, `Next`, `Previous`) y emitirlos al frontend como `prisma://smtc-action`.
2. **Comandos Tauri**:
   - `smtc_update_playback(is_playing: bool)`
   - `smtc_update_metadata(title: String, artist: String, album: String, source_path: Option<String>)`
   - `smtc_clear()`
3. **Frontend (`useMediaSessionSync.ts` y `App.tsx`)**:
   - Retirar el audio silencioso `<audio>` de WebView2 que forzaba la creación de la sesión espuria de Microsoft Edge.
   - Sincronizar el estado y metadatos hacia el backend nativo SMTC de Rust.
   - Escuchar `prisma://smtc-action` para responder inmediatamente a las teclas de hardware y botones del flyout de volumen.
4. **Verificación y Pruebas**:
   - `bun run build` y `cargo check` sin errores.
   - Comprobación visual y funcional en Windows 11.

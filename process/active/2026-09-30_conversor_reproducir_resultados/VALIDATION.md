# Validación

- La tabla anterior solo ofrecía quitar elementos. Cada resultado ya conserva `outputPath`, `targetFormat` y estado `completed`.
- El comando existente `quick_look_show_file` valida que el archivo exista y construye su vista previa según la extensión real. Sus componentes de audio y vídeo incluyen controles de reproducción y carga automática.
- La acción envía la ruta de salida, incluso en vídeo a audio. El botón se muestra únicamente tras finalizar correctamente y no navega fuera del conversor.
- `bun run build`: TypeScript y Vite correctos, 278 módulos; advertencia preexistente sobre tamaño del bundle.
- `git diff --check`: sin errores de espacios. Revisada la ruta enviada, el estado de finalización y que el botón no se bloquee por la conversión de otros archivos.
- Reproducción real y aceptación visual pendientes.

## Corrección del 2026-10-03

- Causa comprobada en código: `show_file_path_with_selection` abría sin activar la ventana e iniciaba siempre el vigilante del Explorador. Después de 250 ms de gracia, dos ciclos de 80 ms con Prisma en primer plano cerraban la vista.
- Aperturas explícitas (`show_file_path`) ahora desactivan el seguimiento del Explorador y dan foco al visor. La selección del sistema (`show_current_selection`) conserva su seguimiento. La navegación interna conserva el origen.
- El vigilante comprueba revisión y origen al despertar; las actualizaciones de navegación del Explorador no afectan a vistas abiertas desde Prisma.
- El estado completado usa icono SVG y texto separados, con `white-space: nowrap` y tamaño fijo del icono.
- `bun run build`: correcto; advertencia de tamaño del bundle preexistente.
- `cargo test --manifest-path src-tauri/Cargo.toml selection_watch_tests -- --nocapture`: 3 pruebas correctas, incluyendo exclusión de vistas abiertas desde la aplicación y revisiones obsoletas.
- `cargo build --manifest-path src-tauri/Cargo.toml`: correcto.
- La instancia observada en pantalla corresponde al ejecutable instalado, anterior al cambio. La acción accesible «Ver imagen» devolvió coordenadas fuera de los límites de la ventana; no se cuenta como reproducción ni validación funcional del arreglo.
- Prueba con `src-tauri/target/debug/prisma.exe` compilado mediante `bun run tauri build --debug --no-bundle --config src-tauri/tauri.dev.conf.json`: apertura de la misma imagen WEBP con `--quicklook --multi-instance`, usando `show_file_path`, la misma entrada que usa el comando del conversor.
- La primera comprobación detectó un segundo cierre automático: el hook global emitía `Close` por una tecla externa (VK_PAUSE). Ahora emite `DismissOutside`, que solo oculta cuando corresponde al seguimiento del Explorador; el cierre explícito se conserva.
- Tras esta corrección, las tres pruebas Rust y la compilación de escritorio vuelven a pasar. El visor muestra la imagen WEBP y sigue visible después de una espera explícita de 10 segundos. La comprobación de cambio de foco no se completó: el control de aplicaciones detectó actividad del usuario y se evitó repetir la acción.
- La disposición del check queda comprobada por código y compilación; aceptación visual en el conversor actualizado y reproducción real de audio/vídeo pendientes. El ejecutable instalado no fue sustituido.

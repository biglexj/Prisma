# Validación

- Rama preview. Trabajo previo estaba limpio al iniciar.
- Archivo señalado por Biglex: 4a4e8d97c9134a748835d325f3123ac1.png, Pictures/TikTok. Cabecera ftypheic con marcas mif1/heic/miaf; no es PNG.
- FFprobe incluido identifica HEVC y dimensiones 886 × 1758.
- FFmpeg permite decodificar el contenido sin depender de la extensión. No se añade dependencia ni se instala un códec del sistema.
- El respaldo del visor usa semáforo existente, spawn_blocking, límite de archivo de 120 MB y PNG en memoria. Los resultados asincrónicos de un archivo anterior se descartan al cambiar la ruta o revisión.
- TypeScript y Vite iniciales correctos; advertencia preexistente de tamaño del bundle.
- Prueba real con el HEIC señalado: copias con extensiones PNG, HEIC y HEIF; decodificación, miniaturas y conversión a PNG/JPEG/WebP correctas, sin alterar el original y con protección contra sobrescritura.
- Pruebas de decodificación nativa con transparencia, clasificación y conversión de medios existentes correctas.
- Compilación de depuración Tauri correcta antes del añadido de carga. Quick Look mostró visualmente la imagen HEIC de 886 × 1758. La comprobación visual del visor completo quedó pendiente por actividad del usuario.
- Añadido estado circular de carga compartido con retardo umbral de 1 segundo (1000 ms), tanto en el visor completo como en Quick Look (imágenes y vídeos), con texto adaptable («Cargando imagen…» / «Cargando vídeo…»), animación de entrada suave, colores del tema y respeto a movimiento reducido. Se oculta si el archivo carga antes del segundo 1 para evitar parpadeos, y se muestra si la decodificación toma más tiempo.
- La aplicación instalada no se ha sustituido. Compilación de desarrollo actualizada con `bun run tauri build --debug --no-bundle --config src-tauri/tauri.dev.conf.json`.
- Ejecutable local verificado y listo en: `src-tauri/target/debug/prisma.exe`. Pruebas unitarias de temporización y suite completa de pruebas superadas al 100%.

# Validación

- Pruebas nativas del codificador: firmas reales PNG/WebP/JPG/ELX, reapertura y dimensiones; comparación exacta de píxeles en los formatos sin pérdidas, teselas y dimensiones impares. PNG/WebP conservan alfa; ELX compone sobre blanco. Rechazo de formato o entrada inválidos.
- Prueba nativa del comando de pantalla: escribe los cuatro formatos en archivos temporales, corrige extensión, vuelve a abrirlos y elimina solo esos archivos de prueba.
- Navegador: tarjeta independiente de cuatro columnas; PNG inicial; cada elección llega al guardado de pantalla por Ctrl+S y al hook real de fotogramas; preferencia persistente al recargar. Los comandos Tauri se simulan en esta prueba de interfaz.
- Compilación final de frontend: `bun run build` completada correctamente después de los cambios de interfaz y formato.
- Pendiente de prueba manual en la app: captura física de escritorio y fotograma de un vídeo real con cada formato. No se confunde esta prueba con los archivos nativos sí verificados.

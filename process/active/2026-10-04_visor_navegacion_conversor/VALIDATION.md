# Validación

- Rama de trabajo: preview. Se conservan las modificaciones de Quick Look y del estado Completado del encargo anterior.
- Causa: ImageViewer emitía prisma-open-converter y después llamaba a closeViewer. VisualLibrary notificaba onCloseViewer, cuyo callback en App restauraba imageReturnView. Si el origen era Inicio, anulaba el destino conversor.
- Ahora se cierra primero y se solicita el conversor después. La transferencia usa el estado converterRequest y props, con consumo único por referencia; no depende de una espera fija ni de un evento emitido antes del montaje del receptor.
- Atajo V sin Ctrl, Alt, Meta o Shift; no actúa en campos editables ni durante edición, comparación o diálogos de renombrado/eliminación.
- bun run build: TypeScript y Vite correctos; advertencia de tamaño del bundle preexistente.
- Compilación de escritorio: bun run tauri build --debug --no-bundle --config src-tauri/tauri.dev.conf.json, correcta.
- Verificación con control de aplicaciones de Windows sobre Prisma (Dev), ejecutable de src-tauri/target/debug. Apertura de biglexj.png como argumento de archivo externo, misma entrada usada por la asociación de archivos del Explorador. V abrió Convertidor Prisma y añadió exactamente una fila biglexj.png, en modo imagen y estado En espera.
- Apertura desde Inicio de Power.png en el visor: V abrió Convertidor Prisma y añadió exactamente una fila Power.png; no restauró Inicio.
- Menú Herramientas, menú contextual y V llaman a la misma función openConverter. El intento de clic automatizado en Herramientas no abrió el menú de forma fiable debido a controles que se ocultan y coordenadas del entorno; no se cuenta como verificación visual de esa opción. Su orden y callback se revisaron en código.
- No se inició ninguna conversión ni se modificaron las imágenes originales. La aplicación instalada no fue sustituida.

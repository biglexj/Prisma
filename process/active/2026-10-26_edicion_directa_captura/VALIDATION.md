# Validación

## Pruebas automatizadas
- [x] Ejecución de la suite completa de pruebas relacionadas a captura de pantalla (`bun test`): 193 pruebas superadas en 37 archivos (incluyendo `screen-capture-direct-draw.test.ts`, `screen-capture-quick-copy.test.ts`, `screen-capture-copy.test.ts`, `capture-pointer.test.ts`).
- [x] Verificación de compilación web limpia con `tsc --noEmit && vite build`: 402 módulos transformados sin errores en 3.71s.

## Pruebas funcionales y de interacción
- [x] **Atajo Ctrl+C**: Con selección rectangular viva, copia directo al portapapeles y Synapse cerrando el overlay de inmediato sin habilitar la barra de herramientas.
- [x] **Tecla Enter**: Con selección rectangular viva, habilita la edición in-situ y despliega las herramientas sin necesidad de realizar garabatos.
- [x] **Garabato directo en el centro**: Al hacer clic y arrastrar en medio del rectángulo seleccionado, el trazo se renderiza reactivamente y se registra en el historial de dibujo in-situ sin requerir doble clic.
- [x] **Clic simple en el centro**: Entra directamente en el modo de edición habilitando las herramientas de anotación sin crear manchas accidentales.
- [x] **Eliminación de doble clic**: Retirado el listener de doble clic y actualizado el badge a `Dibuja o Enter para editar · Ctrl+C para copiar`.
- [x] **Tiradores de redimensionamiento**: Conservan el control perimetral para ajustar el recorte antes de dibujar o copiar.
- [x] **Modo vídeo**: Mantiene el desplazamiento del marco y atajo Enter para iniciar la grabación sin interferencia del modo garabato.

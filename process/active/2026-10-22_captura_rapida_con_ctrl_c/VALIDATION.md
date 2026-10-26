# Validación

## Comprobaciones automáticas ejecutadas

- [x] `bun test tests/screen-capture-quick-copy.test.ts`: 10 pruebas, 15 aserciones, todas en verde. Cubren la ventana bajo el cursor, la subregión, la ausencia de objetivo, el rectángulo arrastrado, el arrastre accidental, el monitor resaltado con respaldo de sesión, el lazo libre con su polígono relativo, el trazo demasiado corto, el selector de color y la conversión del `data URL` a blob PNG con los bytes intactos.
- [x] `bun test`: **141 pruebas superadas, 0 fallidas** (29 archivos), incluidas las tres de `screen-capture-copy.test.ts` que cubren la ruta de copia y su registro en Synapse.
- [x] `bunx tsc --noEmit`: sin errores.
- [x] `bun run build`: correcto. Persiste el aviso de chunks grandes, previo a este cambio.

## Límites de esta validación

Las pruebas son de lógica pura y no tocan el portapapeles ni el IPC real: `resolveSelection` decide la zona y `dataUrlToBlob` conserva los bytes. Lo que **no** está comprobado de forma automatizada es el recorrido físico en la aplicación: que el `Ctrl+C` en el overlay real escriba la imagen en el portapapeles de Windows, que el overlay se cierre y que la captura aparezca en Synapse. Esa comprobación corresponde a Biglex.

Tampoco se comprobó en la aplicación real la persistencia de la selección tras arrastrar un rectángulo ni tras trazar el lazo: el cambio es de flujo dentro del overlay y su razonamiento está cubierto por las pruebas del helper, no por una sesión visual.

## Nota de alcance

No se modificó el backend Rust: el recorte sigue viniendo del fotograma congelado al iniciar la sesión (`confirm_crop`), de modo que el overlay nunca aparece dentro de la imagen. No se tocó la versión ni se publicó nada.

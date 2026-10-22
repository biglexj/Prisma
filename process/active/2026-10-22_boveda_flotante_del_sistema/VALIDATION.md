# Validación

## Comprobado en la aplicación real

- **La bóveda flota en el sistema**: ventana propia, siempre encima, en el borde superior central. Medido sobre la pantalla real de 1920×1080: la ventana aparece en `(827, 0)` con `266×76`, es decir, centrada de forma exacta ((1920 − 266) / 2 = 827).
- **Replegada mide 80 × 3 px** cuando la bóveda está vacía, tal como se pidió.
- **Los tres elementos se ven y el fijado va primero**: con la bóveda cargada con tres elementos (uno fijado), la estantería muestra las tres tarjetas en el borde superior de la pantalla, con el distintivo de candado en la primera.
- **El tamaño se ajusta solo**: la ventana crece con el número de elementos y vuelve a 80 × 3 cuando se vacía.
- **La bóveda sobrevive a un reinicio**: se verificó con un archivo `vault.json` escrito antes de arrancar, que la aplicación leyó con sus tres elementos.

## Pruebas automáticas

- `cargo test --lib`: **85 pruebas superadas**, 7 ignoradas y 2 fallidas. Las dos que fallan son `infrastructure::windows_com::tests::audio_helper_*`, del feature de audio relay, y son **intermitentes desde antes de este trabajo** (1 de 4 ejecuciones falla sin estos cambios, 2 de 5 con ellos).
- Pruebas nuevas de la bóveda: máximo de tres elementos, el fijado no se expulsa y queda primero, solo un elemento fijado a la vez, y persistencia tras reiniciar.
- Pruebas nuevas de la copia: el archivo se copia, no se pisa el existente (añade «(1)») y la carpeta de destino se crea si no existe.
- Frontend: `tsc --noEmit` sin errores, 64 pruebas del frontend en verde y `bun run build` correcto.

## Detalle de implementación

- **Carrera de arranque**: la webview de la zona arranca antes de que el backend registre el estado de la bóveda. Se resolvió con reintentos en el frontend; sin eso la bóveda aparecía vacía aunque el archivo estuviera bien.
- **Procesamiento doble**: la ventana principal también recibe el evento de soltado del sistema. Un indicador en el backend (`drop_zone_is_active`) le dice que la zona ya se quedó con el archivo, así que no lo añade también a una biblioteca.
- **Arrastre hacia fuera**: se reutiliza el arrastre nativo que ya usa el visor rápido (`tauri-plugin-drag` con `mode: "copy"`), con su icono de vista previa. Al soltarlo en el Explorador de archivos se hace una copia.
- **Envío al teléfono**: la bóveda avisa a la ventana principal por evento; si Prisma está en la bandeja, la ventana principal se muestra y abre el diálogo de Super Galería.

## Pendiente

- Comprobar a mano el arrastre real desde el Explorador hasta la bóveda y el arrastre de vuelta hacia el Explorador: la ruta de eventos y los comandos están implementados y probados por separado, pero la maniobra física del ratón no se ha automatizado.

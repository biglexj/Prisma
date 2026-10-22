# Validación

## Comprobado en la aplicación real

- **La bóveda flota en el sistema**: ventana propia, siempre encima, en el borde superior central. Medido sobre la pantalla real de 1920×1080: la ventana aparece en `(920, 0)` con `80×20`, es decir, centrada de forma exacta ((1920 − 80) / 2 = 920).
- **La pestaña se ve y se despliega**: la franja aparece arriba al centro con el color de la app y una línea de acento. Al pulsarla se despliega la estantería con las tarjetas y se repliega sola al perder el foco.
- **Esquinas rectas arriba y redondeadas abajo**: comprobado sobre la captura ampliada de la ventana, que es exactamente lo pedido. Se consigue con la preferencia de esquinas de DWM (`DWMWCP_ROUNDBOTTOM`), que Windows 11 respeta y devuelve con valor 4.
- **Los elementos se ven y el fijado va primero**: con la bóveda cargada, la estantería muestra las tres tarjetas con el distintivo de candado en la primera.
- **Los elementos se guardan y sobreviven a un reinicio**: se verificó con un `vault.json` escrito antes de arrancar, que la aplicación leyó con sus tres elementos.

## Tres problemas reales encontrados por el camino

1. **Una ventana transparente de 80 × 20 no se compone.** Con el fondo transparente la ventana no pintaba nada: se veía lo que hubiera detrás. Se comprobó pintando un color sólido y, después, redimensionando la ventana, que sí se componía. La solución: ventana opaca con el color de la app y esquinas redondeadas solo abajo por DWM.
2. **La caché del WebView2 servía bundles viejos.** Una ventana podía quedarse con el contenido de otra (la barra llegó a mostrar el flyout). Se aisló con una entrada HTML propia (`zone.html` → `src/zone.tsx`) y, en desarrollo, limpiando los datos de navegación al arrancar.
3. **El atajo global parecía inactivo cuando sí lo estaba.** La webview preguntaba el estado antes de que el backend registrase el estado: la consulta fallaba y la interfaz se quedaba diciendo «inactivo» para siempre, además de que la migración de la preferencia antigua lo desactivaba (traía `enabled: false` de cuando el atajo solo vivía dentro de la aplicación). Ahora la consulta reintenta y la migración deja el atajo **activo**, migrando solo la tecla.

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
- El audio del sistema sigue sin poder verificarse con sonido en este equipo (el dispositivo de salida no renderiza), igual que en la tanda anterior.

## Capturador: rediseño de la vista

- La vista pasa a ocupar **todo el ancho**, con dos columnas como el resto de pestañas, y sin los bloques de texto largo.
- El selector **Imagen | Vídeo** y las opciones de modo son **tarjetitas** con el mismo lenguaje visual que las de Configuración.
- El atajo global tiene su propio panel con las teclas disponibles y su estado real: «Atajo Activo» cuando el sistema lo aceptó.
- Verificado en la aplicación: la vista se ve a todo el ancho, con el selector en tarjetitas y el distintivo de «Atajo Activo».

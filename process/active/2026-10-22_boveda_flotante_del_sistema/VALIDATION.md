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


## Validación de la ampliación de cinco espacios — 2026-10-22

Esta sección corresponde al código actual y no hereda como evidencia las afirmaciones anteriores sobre 80×20, tres tarjetas o un valor DWM. Ahora las esquinas se recortan con una región Win32.

- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib app::commands::vault -- --test-threads=1`: 7 pruebas, capacidad, orden, fijados, persistencia y materialización/copia.
- [x] `bun test tests/synapse-notch.test.ts tests/drop-zone.test.ts`: 5 pruebas; destinos con DPI y región de tarjetas.
- [x] `bun run build`: TypeScript y Vite correctos; permanece aviso de chunks grandes.
- [x] Ejemplo Tauri aislado compilado y ejecutado: captura de la franja real de 100×3 y captura del notch de 600×264, cinco cuadros vacíos y tres destinos. WebView2 real, sin reiniciar el proceso del usuario.
- [ ] Prueba del arrastre desde/hacia Explorador en el código nuevo.
- [ ] Arrastre de imagen desde navegador y texto/imagen pegados con Ctrl+V en la ventana nueva.
- [ ] Recepción física en un teléfono con Super Galería. El ejemplo aislado devuelve descubrimiento vacío expresamente y no prueba esa ruta.

Para el ejemplo compilado con Cargo en Windows se necesita el manifiesto Common Controls v6 y las bibliotecas del directorio `target/debug`; el ejecutable del ejemplo no los incluye automáticamente. El primer intento sin manifiesto mostró `TaskDialogIndirect`; la comprobación visual se hizo con una copia del ejecutable y un manifiesto lateral en `target/debug`.


### Acabado final

- [x] Destinos solo durante el arrastre, tres áreas grandes; altura dinámica medida sin la transformación de la animación.
- [x] Cinco espacios cuadrados de 106×106 y acciones al pasar el ratón/foco.
- [x] `bun test tests/synapse-notch.test.ts tests/drop-zone.test.ts`: 6 pruebas, incluidas coordenadas de toda la altura durante el arrastre y DPI.
- [x] `bun run build`: correcto después de los ajustes visuales; aviso existente de chunks grandes.

La comprobación visual anterior corresponde a la ventana aislada del primer diseño; no se atribuye como aceptación del acabado final ni del binario instalado.


### Comprobación visual final en WebView2

- [x] Ventana aislada con la fuente final: captura de cinco cuadros cuadrados en una sola fila y sin los tres destinos visibles al consultar. Franja replegada de 100×3.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib` y build final correctos.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib app::commands::drop_zone -- --test-threads=1`: 2 pruebas de copia sin sobrescritura.
- El binario instalado y la recepción en el móvil no se han validado con este acabado. No se reemplazó la instalación para estas comprobaciones.

### Bordes, hover y cierre del envío

- Contorno de tarjeta sobre la miniatura, recorte limitado a la imagen y margen interior para los controles; ayudas de hover dentro de la barra, sin tooltip flotante. Los destinos ya no cambian de escala ni grosor al seleccionarlos.
- Biglex confirmó el resultado visual: «a ya lo mejoraste ese era».
- Petición posterior: cerrar el panel después de enviar. Implementado al completarse correctamente todos los archivos, tras un segundo para leer la confirmación; conserva el panel en caso de error y cancela el temporizador al desmontarse.
- La recepción física y el cierre posterior a un envío real no se probaron en esta comprobación. El perfil aislado devuelve una lista de teléfonos vacía expresamente.

### Destello blanco al abrir — alcance corregido por Biglex

Biglex confirma que el arrastre funciona y solicita corregir únicamente el destello blanco; conservar la animación y su velocidad. No se modifica la geometría ni las duraciones.

Se iguala el fondo nativo de la ventana y de WebView2 al color real del tema antes de redimensionar; se fija un fondo inicial en la configuración y en el HTML para evitar el blanco previo a la carga del CSS. La corrección del destello en ejecución queda pendiente de comprobación visual con el backend recompilado.

- [x] `bun run build`: correcto.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto.
- [x] Se conservaron las duraciones de apertura, cierre y destinos; no se editaron los estilos de animación en este ajuste.
- No se abrió una instancia adicional ni se inició otro servidor para esta comprobación.

### Salto transitorio de altura al abrir

Causa reproducida con el componente real y el IPC oficial de prueba de Tauri: al montar el panel dentro de la ventana replegada de 100×3, las cinco tarjetas se medían apiladas y se solicitaban 600×607; después del redimensionado a 600 px de ancho se corregía a 600×155. El backend limita el primer alto a 420, que explica el rectángulo grande observado por Biglex. El cambio previo de color no corregía esta medida intermedia.

Corrección: el panel tiene el ancho final desde su primer render, y un único useLayoutEffect mide y solicita el tamaño actual. Se eliminaron el estado separado de altura y la caché del alto anterior. ResizeObserver conserva el ajuste al contenido y descarta callbacks desmontados. Las animaciones y sus tiempos permanecen iguales.

- [x] Regresión `tests/fixtures/synapse-notch-size.html`, servida por Vite: componente real en iframe de 100×3, IPC simulado con retraso de 30 ms y el límite nativo de 420; tres aperturas/cierres y una entrada/salida de arrastre.
- [x] Antes: prueba fallida, máximo solicitado 607, transiciones 607→155.
- [x] Después: prueba correcta, aperturas directamente a 155, arrastre a 165, cierres a 3; ninguna altura intermedia superior a 200.
- [x] `bun run build`: correcto.
- [x] `git diff --check` de los archivos afectados: correcto.

La prueba usa layout real del navegador e IPC simulado; no se presenta como una grabación del compositor nativo de Windows. No se abrió otra instancia de Prisma ni se inició otro servidor.

### Ctrl+V después de abrir por hover

Biglex confirmó que intentaba pegar después de abrir únicamente acercando el ratón. Esa ruta no pedía el foco nativo; además, el manejador de pegado estaba limitado al contenedor React y no recibía eventos cuyo destino fuese body.

La primera solicitud de tamaño al desplegarse pide foco para la ventana y su WebView2. Durante la entrada de un arrastre no se pide foco. El pegado se escucha una sola vez en document, con limpieza al desmontarse; acepta imágenes de files/items y conserva el pegado de texto/HTML existente.

- [x] `bun run build`: correcto.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto, incluido el enfoque explícito de WebView2.
- [x] Prueba Rust `materializa_imagen_png_del_portapapeles_sin_cambiar_transparencia`: correcta; bytes, extensión y canal alfa conservados.
- [x] Componente real con IPC simulado: dos imágenes pegadas desde body y una tarjeta, más texto; exactamente tres importaciones temporales y solicitud de foco al abrir.
- [x] Regresión de tamaños: aperturas de 155 px con foco, arrastre de 165 px sin foco, cierres de 3 px; sin salto de altura.
- [x] `git diff --check` de los archivos afectados: correcto.

El proceso de desarrollo existente recompiló y reinició automáticamente Prisma; no se lanzó una segunda instancia ni otro servidor. La prueba del teclado físico y la recepción del foco en Windows quedan pendientes de confirmación del usuario; los eventos de pegado de la prueba son sintéticos.

### Rotación compartida de capturas y archivos, máximo dos fijados

Aplicada la política final solicitada: cinco espacios compartidos, fijados delante y temporales del más antiguo al más reciente. Cinco capturas con la barra vacía quedan juntas de izquierda a derecha; la sexta expulsa la primera. Con archivos mezclados se aplica la misma antigüedad, sin una casilla exclusiva para capturas. El límite de fijado es dos tanto al importar como al fijar una tarjeta. Se retiró el caso alternativo que podía expulsar un fijado si no había candidatos temporales.

- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib app::commands::vault::tests`: ocho pruebas correctas. Cubren cinco capturas y una sexta, mezcla con archivos, duplicados, persistencia del orden, protección de fijados y rechazo de un tercer fijado por ambas rutas.
- [x] Comprobación de la conexión existente: capturas guardadas, vídeos terminados y fotogramas pasan por `remember_capture` y la misma `VaultState::add`; el frontend presenta la lista recibida sin invertirla.
- [x] `git diff --check` de los archivos afectados: correcto.
- [x] Lectura del estado actual: desarrollo con tres elementos y un fijado; perfil normal vacío. No se modificaron estos archivos de datos ni se insertaron capturas de prueba en la bóveda del usuario.

Las pruebas validan el backend y la persistencia en archivos temporales aislados. No se realizaron cinco capturas físicas desde el capturador ni se presenta la prueba como aceptación visual de Windows. Los perfiles antiguos con más de dos fijados conservan sus fijados actuales; no pueden añadir otros hasta quedar por debajo del límite.

### Capturas copiadas desde Prisma que no aparecían

Biglex confirmó que captura desde Prisma. La conexión anterior solo cubría guardar una imagen en disco, finalizar un vídeo y extraer un fotograma; faltaba la acción Copiar, tanto del overlay como del editor. Ambas rutas escribían el portapapeles y terminaban sin registrar la imagen en Synapse.

Ahora ambas usan `screenCaptureClient.copyToClipboard`: conserva la escritura del portapapeles y registra el mismo blob PNG mediante `vault_import`, como temporal. Esta ruta usa la rotación compartida: con la barra llena reemplaza el elemento más antiguo no fijado, incluida una imagen previamente cargada. No vigila capturas externas ni el portapapeles en general. Synapse conserva una copia interna para poder mostrar, arrastrar o enviar la captura; no se pide una carpeta de guardado. Si falla ese registro, el mensaje distingue que la copia al portapapeles sí se realizó.

- [x] `bun run build`: correcto.
- [x] `bun test tests/screen-capture-copy.test.ts`: tres pruebas, diez aserciones; cinco copias producen cinco importaciones con los mismos bytes, fallo del portapapeles y fallo del registro en Synapse. Portapapeles e IPC simulados; no se modifica el portapapeles del usuario.
- [x] Las ocho pruebas previas del backend verificaron la rotación con imágenes, archivos y fijados; ese algoritmo no cambia en este ajuste.
- Pendiente: confirmación física de Copiar desde el capturador de Prisma y aparición en la barra. Las comprobaciones automatizadas no sustituyen ese recorrido.

### Doble clic en imágenes de Synapse

El doble clic izquierdo sobre una tarjeta de imagen con ruta local invoca el visor existente mediante `quick_look_show_file`. Si abre correctamente se repliega la barra; un fallo conserva la barra y muestra el error. El gesto ignora los botones de acciones y mantiene el arrastre nativo existente, que se inicia al superar el umbral de movimiento.

- [x] `bun run build`: correcto.
- [x] `git diff --check -- src/app/ui/SystemDropZone.tsx`: correcto.
- Pendiente: comprobar el doble clic físico y la apertura de Quick Look en Windows; no se presenta la compilación como esa comprobación.

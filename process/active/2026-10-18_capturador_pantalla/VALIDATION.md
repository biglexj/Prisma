# Capturador de pantalla — Validación

- Estado funcional: `PENDING`. No hay implementación ni pruebas de captura realizadas.
- Revisión documental: referencias locales y estructura del proceso comprobadas el 2026-10-18.

## Atajo global que no respondía al arrancar — 2026-10-21

Comprobaciones ejecutadas sobre la instancia `Prisma (Dev)` (perfil de datos propio, `PRISMA_DEV=1`) con el servidor de desarrollo de Vite en `127.0.0.1:1421`. La instalación habitual del usuario no se modificó.

- [x] V15 — Sondear el sistema operativo con `RegisterHotKey` antes y después de iniciar Prisma, con la ventana principal oculta.
  - Antes de iniciar: `Shift+PrintScreen` libre (error 0) y `PrintScreen` tomado por `SnippingTool.exe` (error 1409).
  - Tras iniciar la aplicación: `Shift+PrintScreen` tomado por Prisma (error 1409) sin abrir ninguna vista ni visitar Configuración.
  - Registro en la salida estándar del proceso: `[Capturador] Atajo global 'Shift+PrintScreen' registrado con éxito`.
- [x] V16 — Pulsar el atajo con la aplicación minimizada y comprobar la capa de selección.
  - La ventana `Prisma · Captura` pasa de `visible=False` a `visible=True` al simular Mayús+Impr Pant, con la aplicación en segundo plano y DaVinci Resolve en primer plano.
- [x] V17 — Forzar un conflicto de atajo desde el propio sistema: retener `PrintScreen` con `RegisterHotKey` y elegir «Impr Pant» en la vista Capturador.
  - Resultado: `[Capturador] Atajo 'PrintScreen' ocupado; se activó 'Shift+PrintScreen' como alternativa`.
  - Interfaz: insignia «Atajo alternativo activo», aviso ««PrintScreen» está en uso por otra aplicación (Recortes de Windows, ShareX u otra). Se activó «Shift+PrintScreen» en su lugar» y el atajo efectivo sigue operativo.
  - Configuración muestra la misma línea de estado y marca «Impr Pant — En uso por otra aplicación».
- [x] V18 — Persistencia y reinicio.
  - Archivo escrito en el directorio de datos: `screen_capture.json` con `{ version, enabled, shortcut }`.
  - Tras reiniciar la aplicación, el registro ocurre desde la preferencia guardada, sin intervención del frontend, y la pulsación del atajo vuelve a abrir la capa de selección con la aplicación minimizada.
- [x] V19 — Comprobaciones estáticas.
  - `cargo check --lib`: correcto, código de salida 0.
  - `cargo test --lib preferences`: 2 pruebas del módulo `features::screen_capture::preferences` superadas, 0 fallos.
  - `bun run check` (`tsc --noEmit`): correcto, código de salida 0.
- [ ] V20 — Comprobar el mismo recorrido en la instalación habitual después de recompilar e instalar. Pendiente: la publicación y la instalación no forman parte de este ciclo y el binario instalado actual (1.1.8, compilado a las 09:05) no contiene estos cambios.

Límite de esta comprobación: la validación se hizo sobre la instancia de desarrollo y con la tecla simulada por `keybd_event`. La pulsación física de Biglex y el comportamiento de la instalación compilada siguen pendientes.

## Comprobaciones para la implementación

- [x] V01 — Ejecutar las comprobaciones de TypeScript/Rust del repositorio y las pruebas pertinentes de geometría, estados y composición. Registrar comandos y resultados reales.
  - `cargo check`: Completado sin errores ni advertencias (código de salida 0). Módulos de captura `features::screen_capture` e `invoke_handler` verificados.
  - `bun run check` (`tsc --noEmit`): Completado sin errores (código de salida 0).
  - `bun run build` (`vite build`): Completado con éxito en 4.37s.
- [ ] V02 — Abrir desde Herramientas y por atajo con Prisma minimizado. Esperado: una sola selección, Ventana por defecto y sin restaurar la ventana principal sobre el objetivo.
- [ ] V03 — Recorrer con el cursor dos aplicaciones, una ventana parcialmente oculta y una parcialmente fuera del monitor. Esperado: borde actualizado, captura del área visible y coincidencia entre borde y píxeles finales; sin recuperar contenido oculto.
- [ ] V04 — Recorrer regiones internas detectables y una interfaz sin controles detectables. Esperado: selección precisa cuando existe información suficiente; alternativa explícita cuando no existe. Registrar aplicaciones y regiones realmente probadas.
- [ ] V05 — Arrastrar y ajustar Rectángulo en varias direcciones y capturar Pantalla completa en cada monitor. Esperado: tamaño y posición correctos, sin selector ni borde en el resultado.
- [ ] V06 — Repetir con escalas 100 %, 125 % y 150 % cuando estén disponibles, DPI mixto y un monitor a la izquierda del principal. Esperado: sin desplazamiento ni reescalado de píxeles. Si falta hardware, mantener pendiente y describirlo.
- [ ] V07 — Escribir texto y dibujar/resaltar; borrar, deshacer y rehacer. Copiar y guardar. Esperado: ambas salidas coinciden con lo mostrado a resolución original; Ctrl+C no impide copiar texto dentro de su campo.
- [ ] V08 — Pegar la imagen en otra aplicación real. Repetir con portapapeles ocupado o error inducido. Esperado: imagen pegable y mensaje recuperable si falla; no marcar la copia como correcta ante error.
- [ ] V09 — Observar escrituras del proceso durante captura, edición, copia y cancelación mediante una herramienta de trazado de archivos. Esperado: ningún archivo, miniatura, historial o caché de la captura creado por Prisma. Separar el ruido del runtime y las políticas externas de historial/sincronización del portapapeles; no prometer controlar las escrituras del sistema operativo.
- [ ] V10 — Guardar en carpeta elegida, cancelar diálogo, probar destino sin permisos y archivo existente. Esperado: PNG válido con dimensiones y anotaciones correctas; errores no pierden la captura ni sobrescriben silenciosamente.
- [ ] V11 — Probar atajo libre y ocupado por ShareX/otro programa, pulsación sostenida, tecla alternativa, desactivar herramienta y cerrar/reabrir Prisma. Esperado: sin duplicados ni cambios automáticos a programas externos; acceso por Herramientas disponible ante conflicto.
- [ ] V12 — Pulsar Esc antes/después de seleccionar, cerrar editor y repetir capturas. Esperado: recuperación de foco y liberación de recursos; ninguna escritura o copia automática al cancelar.
- [ ] V13 — Comprobar editor en barra de tareas/Alt+Tab, capa de selección excluida y cierre independiente. Confirmar con Biglex la interpretación de «task» al presentar el resultado.
- [ ] V14 — Revisión visual de flujo, contraste del borde y cantidad de controles con Biglex. Registrar límites de superficies protegidas o no capturables cuando se observen; no inventar compatibilidad.

## Evidencia y fallos

- **2026-10-18**:
  - Compilación técnica completada al 100% (`cargo check` y `bun run check` limpios con código 0).
  - Backend Rust: `features/screen_capture` (`capture.rs`, `windows.rs`, `session.rs`) y comandos Tauri en `app/commands/screen_capture.rs`.
  - Transición a Captura In-Situ: la confirmación recorta el snapshot en memoria y transiciona directamente en el overlay a la fase de anotación sin abrir ventanas auxiliares externas, enmarcando con precisión milimétrica el área tomada.
  - Corrección del motor de dibujo de lápices/formas: se solucionó la mutación repetitiva de dimensiones de canvas que limpiaba el buffer en cada render. Integración de Pointer Events (`setPointerCapture`) para trazos continuos, fluidos y sin saltos.
  - Color insignia de Prisma: `#00C9B9` configurado en el primer puesto de la paleta y seleccionado por defecto.
  - Deshacer canónico con `Ctrl + Z`, Rehacer con `Ctrl + Mayús + Z` (y `Ctrl + Y`), Copia en memoria sin tocar disco con `Ctrl + C` / `Enter`, y Guardar como PNG con `Ctrl + S`.
  - Diagnóstico de ShareX y tecla Impr Pant: documentado procedimiento para desactivar la interceptación nativa de Windows 11 (Herramienta Recortes) y liberar el atajo global.
  - Barra de herramientas superior permanente: reubicada de forma fija en la parte superior (`position: fixed; top: 24px; left: 50%`) simulando una ventana completa, eliminando solapamientos con la selección o el recorte. Componente modular `CaptureAnnotationBar` creado.
  - Modo Lazo Libre (`freeform`): trazado a mano alzada con feedback SVG en vivo (trazo `#00C9B9` punteado con resplandor), recorte mediante máscara `ctx.clip()` sobre el polígono y exportación a PNG con transparencia total fuera del lazo.
  - Modo Rectángulo y tiradores: rediseñado con viñeta exterior de oscurecimiento (`box-shadow: 0 0 0 9999px rgba(0,0,0,0.45)`), contorno cyan nítido y 4 tiradores de esquina (`nw`, `ne`, `se`, `sw`) con `setPointerCapture` y cálculo de deltas respecto al snapshot inicial, impidiendo reseteos accidentales y permitiendo desplazamiento interior del marco.
  - Restauración de Barra de Anotaciones Original: se restableció el marcado y personalidad visual del componente `CaptureAnnotationBar` con botón insignia `capture-btn-primary` para Copiar (#00C9B9), `capture-pill-btn` para Guardar, `.capture-color-swatch` con escalado interactivo, selectores de grosor circulares, lápiz (`edit`) y papelera (`trash`). Se mantiene anclada fijamente arriba y centrada horizontalmente.
  - Desbloqueo de Modo Ventana: se corrigió la condición en `handleClickSelecting` que descartaba clics dentro de `.capture-target-box`, agregando `onClick` directo en el target box con `cursor: pointer` y soporte para confirmación con `Enter`.
  - Persistencia de Herramienta Previa: se guarda en `localStorage` (`"prisma.screen-capture.last-mode"`), recordando de sesión a sesión si el usuario prefirió Ventana, Rectángulo, Lazo o Pantalla Completa.
  - Atajos en Fase de Selección: `V` para Ventana, `R` para Rectángulo, `Q` para Lazo y `F` para Pantalla Completa inmediata (capturando el monitor activo y desplegando las herramientas in-situ al instante).
  - Eliminación de corte en bordes derecho e inferior: `.capture-inplace-box` migrado a `box-sizing: border-box;` y borde interno `inset 0 0 0 1.5px #00C9B9`, garantizando que en áreas completas (1920x1080 o ventanas maximizadas) ningún píxel del contorno desborde la pantalla.
  - Tiradores de redimensionamiento estilo Windows Snipping Tool: 4 esquinas L-bracket blancas (`┌`, `┐`, `┘`, `└`) de 3.5px con esquinas redondeadas y 4 barras rectangulares centrales blancas con sombra, replicando la apariencia nítida de Windows.
  - Barra de selección compacta estilo Windows: rediseñada con ancho mínimo (~110px), botón selector con icono activo y flecha desplegable (`▼`), abriendo un menú contextual con indicador cyan vertical para Rectángulo, Ventana, Pantalla completa y Forma libre.
  - Cuentagotas / Selector de Colores (Eyedropper): herramienta de inspección de píxeles en memoria sobre el canvas compuesto; muestra cursor personalizado de mira y tooltip flotante con muestra cromática en vivo, código `#HEX` y `RGB(r, g, b)`. Al hacer clic, copia instantáneamente el `#HEX` al portapapeles con toast de confirmación y lo asigna como color activo de anotación.
  - Guardado automático directo (Ctrl + S / Botón Guardar): genera automáticamente el nombre de archivo cronológico `Prisma_Captura_YYYY-MM-DD_HH-mm-ss.png` y lo almacena sin solicitar confirmación repetitiva en `<Imágenes>\Capturas` (o la ruta personalizada elegida en Ajustes), con creación automática de directorios en Rust.
  - Nuevas metas en ROADMAP.md: Extractor de texto (OCR en memoria) y Grabadora de vídeo de pantalla registrados en pendientes activos.
  - Cuadro de Texto Interactivo In-Situ: sustitución de `window.prompt` por una caja de texto delimitada editable sobre el lienzo; permite definir el marco mediante arrastre o con un solo clic, auto-enfoque al soltar, soporte multilínea tipográfico nítido y confirmación con `Enter` o botón de verificación y cancelación con `Escape`.
  - Barra Superior en Una Sola Fila Refinada: retorno al formato de fila única horizontal (`is-refined-row`) con estética Material 3 Expressive (cápsula translúcida, desenfoque de 20px y elevación profunda), integrando los 4 modos de captura (`R`, `V`, `F`, `Q`), el Selector de Color con atajo canónico `C` (con muestreo nativo directo del snapshot en memoria en Rust mediante `screen_capture_pick_color`, copia inmediata de `#HEX` al portapapeles y cierre fluido) y botón de cierre (`Esc`).



## Verificación de refinamientos — 2026-10-18

Alcance: reinicio de sesión, iconos, flecha, círculo/elipse y marco con tiradores. Pruebas sobre Prisma (Dev), ejecutable src-tauri/target/debug/prisma.exe, recompilado por el proceso tauri dev existente.

- PASS: `bun run build` (TypeScript y Vite); avisos de tamaño de bundle y mezcla de importación estática/dinámica ya presentes.
- PASS: `bun run check` después de los últimos cambios de lógica.
- PASS: `bun test test/captureAnnotations.test.ts`: 3 pruebas, 29 aserciones. Flechas horizontales, verticales, diagonales y cortas; sin punta si longitud cero; círculo/elipse.
- PASS: `git diff --check`.
- PASS nativo: el watcher recompiló Rust y volvió a abrir la app de desarrollo; se ejercitaron sus comandos reales de captura, recorte, copia y cancelación. No se generó instalador ni se publicó versión.
- PASS UI: Impr Pant abre la capa real; captura rectangular, ampliación con esquina inferior derecha y reducción con esquina superior izquierda. Flecha y círculo conservan su posición después del segundo recorte.
- PASS UI: captura de una ventana de Bloc de notas (932 × 644), con contorno segmentado, cuatro esquinas y cuatro barras centrales turquesa tanto en selección como en anotación.
- PASS UI: cerrar con Texto seleccionado y un cuadro vacío activo; reabrir y confirmar. Arranca en Ventana, luego Lápiz; el cuadro anterior desaparece.
- PASS UI: activar Selector de color, cancelar y reabrir. Arranca en Ventana; no queda activo el selector de color.
- PASS UI: pantalla completa confirma el monitor y mantiene contorno sin tiradores.
- PASS portapapeles: Copiar produjo una imagen real recuperable mediante el portapapeles de Windows, 1206 × 319. Inspección de sus píxeles: flecha y círculo presentes; barra, marco y tiradores ausentes. Esto comprueba imagen en el portapapeles, no un pegado en otra aplicación.

Evidencia local solicitada para el chat, dentro de temp/capture-review-2026-10-18/: rectangulo.jpg, ventana.jpg, ventana-anotacion.jpg y portapapeles.png. Las imágenes UI se obtuvieron del runtime de control de Windows; portapapeles.png es la imagen que Prisma copió.

No se repitió la matriz histórica completa (DPI mixto, pantallas adicionales, errores de guardado, atajos ocupados, trazado de disco). La aprobación visual de Biglex sigue pendiente. Los demás cambios locales del repositorio se preservaron.


## Mayús y vista durante redimensionamiento — 2026-10-19

- `bun test test/captureAnnotations.test.ts`: PASS, 5 pruebas y 37 aserciones. Proporción 1:1 en cuatro direcciones y arrastre axial, retorno a proporciones libres, flechas y elipses.
- Prueba de interfaz con Playwright/Edge sin ventana y eventos/comandos Tauri simulados: PASS. Se ejecutó el componente real de selección y anotación contra una imagen de cuadrícula con círculo.
- Para rectángulo y elipse se verificaron los píxeles dibujados antes de Mayús, al presionarlo sin mover el puntero, al soltarlo sin mover y al confirmar con Mayús: dimensiones iguales para cuadrado/círculo y libres al soltar Mayús.
- Durante un arrastre sostenido de la esquina superior izquierda, el marco redujo el área visible y el lienzo conservó exactamente posición y tamaño: x=222, y=240, ancho=650, alto=500 antes/durante. Viewport con overflow hidden. Se verificó también ampliación desde la esquina inferior derecha sin cambiar la geometría del lienzo durante el arrastre. Al soltar ambos tiradores se cargó el nuevo recorte.
- `bun run build`: PASS (TypeScript y Vite); permanecen los avisos de tamaño de bundle y mezcla de importaciones.
- `git diff --check`: PASS.
- Evidencia de la prueba aislada: `temp/capture-followup-2026-10-19/ui-check.mjs` y `redimensionando.png`. Esto valida la interacción del frontend; no constituye una nueva prueba nativa de captura de Windows ni una aprobación visual de Biglex.


## Atajos y persistencia del modo — 2026-10-19

- PASS `bun run build`: TypeScript y Vite; se conservan los avisos existentes sobre tamaño de bundle e importaciones mixtas.
- PASS `bun test test/captureControls.test.ts test/captureAnnotations.test.ts`: 8 pruebas, 86 aserciones. Mapeos de herramientas, colores del teclado principal y numérico, grosores con Mayús, respeto a Ctrl/Meta/Alt, persistencia de los cuatro modos, rechazo de valores inválidos/selector de color y almacenamiento bloqueado.
- PASS interfaz aislada en Edge/Playwright, componente real con eventos y comandos Tauri simulados: teclas B/R/T/S/C/F seleccionan el botón correspondiente; 1–7 y Numpad2 eligen su color; Mayús+1/2/3 seleccionan grosor. Tooltips contienen los atajos.
- PASS escritura real de `brtscf1234567` en el cuadro de texto: no cambia herramienta; Ctrl+C no copia la imagen ni cierra la captura; Esc cierra el cuadro. N vuelve a selección y no quedan insignias visibles de atajos.
- PASS confirmar Rectángulo, usar Selector de color y recargar la página: la nueva sesión restaura Rectángulo aunque el backend indique Ventana, sin cuadro de texto ni lienzo anteriores.
- PASS regresión de Shift cuadrado/círculo y redimensionamiento sin deformación dentro del mismo ensayo de interfaz.
- Script de evidencia: `temp/capture-followup-2026-10-19/shortcuts-check.mjs`. La comprobación usó captura/IPC simulados, no una nueva validación nativa de Windows.


## Modo Ventana roto y sesión obsoleta — 2026-10-19

- PASS `cargo check --lib` y `bun run check` (`tsc --noEmit`): sin errores (código de salida 0).
- PASS `cargo test --lib screen_capture`: 4 pruebas superadas (3 nuevas de regresión sobre ventanas del sistema y hit-test, 1 preexistente de formatos de guardado).
- PASS UI en Prisma (Dev), ejecutable `src-tauri/target/debug/prisma.exe` recompilado por el watcher de `tauri dev`:
  - Al abrir la captura en modo Ventana **no** aparece ninguna selección previa ni viñeta de oscurecimiento: la barra de tareas dejó de quedar preseleccionada (antes ocupaba 48 × 1080 px en el borde izquierdo).
  - Al mover el cursor sobre una ventana, el contorno turquesa sigue al puntero y encuadra la ventana (medido: bordes en x=48 y x=1919 para una ventana de 1872 × 1080 px).
  - Al situar el cursor sobre la barra de tareas **no** se selecciona nada: la barra de tareas ya no es capturable en modo Ventana.
  - Modo Rectángulo: el arrastre dibuja el marco con la insignia «400 × 400 px · Doble clic o Enter para capturar».
  - Selector de color: el tooltip sigue al puntero con muestra, `#E6D2C1` y `rgb(230, 210, 193)`.
  - Confirmar una captura lleva a la fase de anotación y una nueva captura por atajo devuelve el overlay a la fase de selección con la barra de modos.
- Diagnóstico previo (antes del arreglo): con la instrumentación temporal en el overlay se comprobó que el contenedor recibía los eventos (`moves`, `downs` y `winMoves` enunus) pero que la sesión podía quedar nula u obsoleta, dejando `activeTarget` clavado en `Shell_TrayWnd` (48 × 1080 px) y la fase de anotación sin reiniciar; por eso el «rectángulo» se dibujaba como trazo de lápiz. La instrumentación se retiró tras el diagnóstico.
- No se repitió la matriz histórica completa (DPI mixto, pantallas adicionales, errores de guardado, atajos ocupados, trazado de disco). La aprobación visual de Biglex sigue pendiente.


## Entrada con lápiz de tableta gráfica — 2026-10-19

- PASS `bunx tsc --noEmit` (salida 0), `bun test test/` (36 pass / 0 fail) y `cargo test --lib` (68 pass / 0 fail).
- PASS Con la sonda temporal en el overlay se comprobó que, tras migrar a eventos de puntero, la webview recibe los eventos del lápiz: el panel marcaba `{"move:pen":"286","down:pen":"2"}` frente a cero eventos de ratón anteriores.
- PASS Con el lápiz se confirmó una captura y se pudo escribir sobre el lienzo (trazo visible en la fase de anotación), es decir, la ruta de puntero llega hasta el lienzo y la confirmación.
- PASS Con ratón sintético el ciclo sigue completo: arrastre → rectángulo con la insignia de medidas → soltar → fase de anotación con marco y tiradores; el hover del modo Ventana sigue al cursor y la barra de tareas no es seleccionable.
- Pendiente de confirmación por Biglex: probar el lápiz físico en los modos Rectángulo y Ventana (no hay dispositivo de entrada por lápiz disponible en el entorno de pruebas, de modo que la ruta del lápiz se validó con eventos de puntero sintéticos `pointerType: "pen"` y con los eventos reales capturados durante la sesión).
- La instrumentación temporal (sonda de puntero, auto-prueba de lápiz y panel de lectura) se retiró tras el diagnóstico.


## Overlay minimizado que no volvía a aparecer — 2026-10-19

- PASS Secuencia reproducida y verificada sobre la instancia Dev:
  1. Estado inicial: overlay oculto en `[0,0 1920x1080]`.
  2. PrintScreen: overlay visible en `[0,0 1920x1080]`.
  3. Minimizado (equivalente a `Win+D`): `iconic=True`, rect `[-32000,-32000 160x28]` — fuera de pantalla.
  4. PrintScreen de nuevo: `iconic=False`, rect `[0,0 1920x1080]` y barra de modos visible en pantalla.
- PASS `cargo check --lib` sin errores tras el cambio (`unminimize()` en el atajo global y en `screen_capture_start`).
- Observación: esta condición también explica que en determinadas revisiones la captura «no apareciera», lo que el usuario reportaba como «no hay rectángulo».

## Recuperación entre contactos y capturas — 2026-10-20

- Reproducción antes del cambio: tras un contacto sin `pointerup`, un nuevo contacto principal con otro `pointerId` no pintaba; el píxel final seguía blanco. Después del cambio, el mismo caso deja el trazo esperado. `CapturePointer` sustituye el contacto anterior y tolera que el controlador rechace captura explícita o desaparezca la superficie.
- Otra regresión reproducida: una copia de portapapeles pendiente de la captura anterior cancelaba la sesión siguiente (`cancelCount=1` cuando debía ser cero). Ahora las operaciones y los temporizadores comprueban la revisión de captura antes de cerrar; pruebas de copia tardía y guardado anterior: PASS.
- PASS interfaz: 20 sesiones con eventos `pointerType: "pen"`, cambios de identificador, contactos incompletos y pérdida de foco; otras 5 sesiones con entrada de lápiz generada por Chromium/CDP y captura explícita del puntero. Verificación de tinta en el lienzo y ausencia de errores de página. Transporte Tauri simulado: no se presenta como prueba del hardware físico.
- PASS las 8 regresiones anteriores de interfaz: selección y punto final, dibujo rápido, cancelar y continuar, segundo puntero, lazo, barra de tareas y clic sin hover. Los cuatro formatos globales siguen pasando sus rutas de pantalla, fotograma y editor.
- Windows Dev real: tres recortes con trazo visible, con entrada de ratón automatizada: primero, reselección (`N`) y nueva sesión después de Alt+F4. El overlay se ocultó y volvió a abrir con el mismo HWND, sin reiniciar Prisma. El helper dio inicialmente `coordinate input geometry is unavailable`; la comprobación se completó al refrescar la captura y usar sus coordenadas actuales.
- PASS `bun test tests`: 55 pruebas, 217 aserciones, cero fallos. Compilación `bun run build`: PASS; permanecen las advertencias conocidas de tamaño de bundle e importación mixta. Regresiones persistentes: `tests/capture-pointer.test.ts` y `tests/capture-target-query.test.ts`.
- Evidencia y scripts locales: `temp/capture-audit-2026-10-20/pen-lifecycle.mjs`, `pen-async.mjs`, `check.mjs` y `lapiz-repetido.png`. Los scripts temporales no forman parte de la publicación.
- Pendiente: lápiz físico en la compilación actualizada y DPI mixto. La instalación habitual mantiene su binario previo y ocupa el atajo global; las pruebas de código nuevo se dirigieron a `Prisma (Dev)` desde Probar Captura.

## Marco estable al cambiar de ventana — 2026-10-20

- Antes del cambio, el muestreo visual registró 22 alternancias de posición al mover el puntero dentro de Ventana 2: el catálogo inicial reemplazaba el objetivo nativo en cada movimiento y la respuesta nativa lo restauraba. Ese mismo borrado afectaba a las subregiones.
- Se retiró el reemplazo provisional: el marco conserva el objetivo actual hasta la siguiente respuesta nativa. Los movimientos repetidos en el mismo punto tampoco invalidan una consulta ya en curso.
- PASS `window-flicker.mjs`: ratón y lápiz simulados; 53/56 fotogramas de hover con posición estable y 37/38 fotogramas de subregión sin alternancia. Transiciones Ventana 2 → Ventana 1 → subregión → barra de tareas, sin errores de página. Tauri simulado.
- PASS 9 pruebas de contacto y consultas de ventana, incluidos puntos idénticos durante una consulta; PASS nuevamente 20 sesiones de lápiz sintético y 5 sesiones con entrada pen de Chromium/CDP. PASS `bun run build` con las advertencias conocidas de bundle/importación mixta.
- Script de reproducción y comprobación: `temp/capture-audit-2026-10-20/window-flicker.mjs`. La revisión física del marco con la tableta corresponde a la compilación Dev actualizada.

## Comprobación con el lápiz físico — 2026-10-20

- Biglex confirma que abre desde «Prisma (Dev) → Probar Captura» y, tras reiniciar Dev, que el lápiz funciona en varias capturas consecutivas. Aporta una captura con trazos turquesa y rojos visibles.
- La sonda local registró 16 contactos reales de lápiz (`isTrusted=true`), con 16 `pointerdown`, 16 `pointerup`, 16 capturas/liberaciones de puntero y 341 movimientos. Los contactos del lienzo llegan al canvas y habilitan Deshacer. No se registraron cancelaciones durante esta muestra.
- No se reprodujo el bloqueo en esta muestra: no se atribuye una causa nueva ni se garantiza que no pueda reaparecer. La recuperación observada siguió al reinicio de Dev; las correcciones previas de contactos y sesiones se mantienen.
- La sonda se retiró de `src/main.tsx` y se detuvo el servidor local de diagnóstico. Registro temporal: `temp/capture-audit-2026-10-20/device-events.ndjson`.
- PASS `bun test tests`: 56 pruebas, 219 aserciones y cero fallos.

## Bloqueo posterior en la instalación — revisión reabierta

- Biglex confirma que la instalación permite usar los botones de ambas barras, pero deja de aceptar arrastre de Rectángulo y anotaciones después de funcionar al arrancar. Ratón apagado; no hay evidencia de que sea la causa.
- Se preparó `--capture-diagnostics`: registro local acotado en `logs/capture-input.ndjson` dentro del directorio local de Prisma. Incluye tipo de contacto, `isPrimary`, botones, destino, foco, geometría del canvas y estado del gesto antes/después. No registra imágenes ni texto de las capturas. Se desactiva por defecto.
- PASS `trace-filter.mjs`: el filtro actual reproduce el bloqueo de selección y anotación cuando el lápiz llega con `isPrimary=false`; la sonda identifica su descarte. Esto es una reproducción sintética del filtro, no demuestra la causa física.
- PASS las 8 regresiones de interfaz de `check.mjs`, con IPC simulado; PASS 9 pruebas de contactos y consultas de ventana. PASS TypeScript y Vite, con avisos conocidos de tamaño de bundle/importación mixta.
- Pendiente: capturar el fallo físico con el registro de la compilación de producción. No se ha cambiado aún la política de aceptación de contactos.
- PASS `bun run tauri build --no-bundle`: producción optimizada con archivos del frontend empaquetados. Se abrió con `--capture-diagnostics`, sin `--dev`, usando el perfil habitual. UI Automation confirma `http://tauri.localhost/`, y el archivo local registra `trace-start` mediante el comando nativo. El intento inicial con Cargo directo se canceló al comprobar que no garantizaba el protocolo de producción.
- La instalación se cerró para evitar dos instancias; su ejecutable no se reemplazó. Proceso de prueba: PID 23004, `src-tauri/target/release/prisma.exe`. Se pidió reproducir hasta el fallo antes de reiniciar; pendiente de esa muestra física.

## Reproducción posterior y rechazo de lápiz secundario — 2026-10-21

- Biglex reproduce de nuevo tras unas 15 capturas, usando el atajo global. El registro de producción contiene únicamente `trace-start`: no capturó esa secuencia. No existe evidencia para atribuirle a esa reproducción un valor concreto de `isPrimary`.
- Con el overlay fallando y abierto, Windows identifica su propietario como `target/debug/prisma.exe` (PID 21544), no la instancia de producción que tenía `--capture-diagnostics`. Se había iniciado otra instancia Dev después de preparar la prueba. La sonda temporal por HMR no llegó a activarse en esa webview; su depurador abrió una ventana en blanco. No se atribuye una causa al fallo a partir de esos síntomas.
- Se corrigió una debilidad reproducida en el filtro común a selección/anotación: `isPrimary=false` descartaba todo lápiz. Ahora el lápiz con botón principal puede iniciar un gesto aunque no tenga esa marca; dedos secundarios y botón lateral siguen rechazados.
- Antes del cambio, `nonprimary-pen.mjs` no podía confirmar Rectángulo (timeout sin canvas). Después, pasan sus 8 regresiones con todos los contactos de lápiz marcados como no principales, incluido el píxel del trazo final. IPC simulado.
- PASS `bun test tests`: 57 pruebas, 225 aserciones y cero fallos. PASS nuevamente 20 ciclos sintéticos y 5 ciclos de entrada pen de Chromium/CDP, sin errores de página.
- Se eliminó el enlace temporal de Dev al servidor HTTP y se detuvo la sonda. El diagnóstico optativo añade PID/tipo de build a cada entrada y títulos diferentes a sus ventanas, para comprobar la instancia exacta. Pendiente de la nueva comprobación física en una sola instancia de producción.

## Restos entre capturas A y B — 2026-10-21

- El cierre anterior dejaba montado el lienzo con sus anotaciones y la imagen congelada, y Rust mostraba el overlay antes de enviar la nueva sesión. La imagen anterior también permanecía en la referencia mientras cargaba la siguiente.
- Ahora el cierre limpia y desmonta la vista; una nueva sesión invalida la imagen anterior y dimensiona su canvas desde el principio. El cierre nativo notifica su identificador y los cierres antiguos se descartan.
- El inicio oculta el overlay previo antes de congelar la pantalla y, si estaba visible en Windows, espera al compositor con `DwmFlush`. Ambas rutas de inicio comparten la preparación; `screen_capture_overlay_ready` muestra únicamente la sesión vigente después de aplicar el estado de React.
- PASS `session-flash.mjs`, componente real con IPC simulado: cancelar deja cero overlays/canvas; la confirmación de B encuentra la fase de selección sin canvas de A; al retrasar la imagen B, sus píxeles permanecen transparentes y con dimensiones correctas, sin fondo ni trazos de A; un cierre nativo limpia la vista y un cierre antiguo no borra la sesión nueva.
- PASS nuevamente las 8 regresiones de lápiz no principal y las comprobaciones de copia/guardado tardíos. TypeScript y Vite sin errores.
- Biglex confirma «el parpadeo ya está saneado» y pide dejar abierta la aplicación para seguir realizando capturas. No se reinicia ni cambia de instancia después de esa indicación. El bloqueo intermitente del lápiz sigue en observación y no se declara cerrado por una recuperación tras recompilar.
- PASS `bun run tauri build --no-bundle`: backend y frontend empaquetados compilaron. Después se añadieron el tamaño inicial del canvas y la invalidación de imagen al confirmar; esos últimos ajustes pasaron `session-flash.mjs` en Dev, pero son posteriores al frontend de ese ejecutable. Regenerar el build antes de una instalación; no se instaló ni se abrió ese artefacto como prueba final.
- PASS final `bun test tests`: 57 pruebas, 225 aserciones, cero fallos. PASS `git diff --check` para los archivos revisados.

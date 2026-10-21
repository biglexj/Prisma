# Capturador de pantalla — Tareas

- Estado: `IN_PROGRESS` — implementación base completada; verificada en TypeScript y Rust.
- Contrato funcional y decisiones: [PLAN.md](PLAN.md).

## Ejecución

- [x] T01 — Revisar instrucciones y cambios locales en `preview`; identificar atajos, ventanas auxiliares, permisos y servicios de imagen reutilizables.
- [x] T02 — Prototipar captura visible y detección de ventana/subregiones con contorno exacto; resolver límites de interfaces que no exponen controles y la exclusión de las capas del capturador.
- [x] T03 — Implementar sesión y geometría compartida: monitores, DPI, regiones, límites, cancelación y liberación de recursos.
- [x] T04 — Implementar modos Ventana por defecto, Rectángulo ajustable y Pantalla completa del monitor seleccionado.
- [x] T05 — Crear flujo de anotación in-situ en el propio overlay (sin abrir ventana secundaria): texto, lápiz interactivo fluido, resaltador, rectángulos, flechas, paleta con color insignia `#00C9B9` en primer lugar y deshacer (`Ctrl+Mayús+Z`/`Ctrl+Z`)/rehacer (`Ctrl+Y`).
- [x] T06 — Integrar copia de imagen sin disco y Guardar como PNG mediante diálogo; conservar la sesión ante cancelación o error.
- [x] T07 — Añadir Capturador a navegación, catálogo de herramientas, preferencias y títulos.
- [x] T08 — Registrar atajo global configurable (propuesta Mayús + Impr Pant; alternativa Impr Pant), conflictos, desactivación y prevención de sesiones duplicadas.
- [x] T09 — Resolver fallos de levantamiento en dev (bloqueo de puerto/proceso huérfano) y corregir dibujo en canvas mediante Pointer Events y tamaño estático.
- [x] T11 — Corregir atajos de teclado en overlay y editor: `Ctrl+Z` para Deshacer y `Ctrl+Mayús+Z` para Rehacer (manteniendo `Ctrl+Y`).
- [x] T12 — Fijar la barra de herramientas de anotación siempre arriba en la pantalla (`position: fixed; top: 24px; left: 50%`) para evitar solapamientos con la selección.
- [x] T13 — Implementar modo de captura "Lazo Libre" (`freeform`) con trazado poligonal a mano alzada y recorte con máscara transparente.
- [x] T14 — Optimizar contorno y tiradores de redimensionamiento de las cuatro esquinas en modo rectángulo con captura de puntero estable.
- [x] T15 — Restaurar diseño original y personalidad visual de `CaptureAnnotationBar` (botones primarios `#00C9B9`, `.capture-color-swatch`, grosores circulares, `.capture-btn-primary` en Copiar, `.capture-pill-btn` en Guardar, `.capture-tool-btn.is-cancel` en Cerrar).
- [x] T16 — Corregir bloqueo en modo Ventana al hacer clic sobre `.capture-target-box` o presionar `Enter` (desbloqueando eventos de puntero descartados).
- [x] T17 — Persistir y recordar la última herramienta/modo utilizada (`localStorage` `"prisma.screen-capture.last-mode"`) entre Ventana, Rectángulo, Lazo y Pantalla Completa.
- [x] T18 — Implementar atajos rápidos `V` (Ventana), `R` (Rectángulo), `Q` (Lazo) y `F` (Pantalla Completa inmediata) en fase de selección.
- [x] T19 — Prevenir corte de bordes derecho e inferior en el área capturada mediante `inset` y `box-sizing: border-box`, con contorno fino no invasivo de 1.5px.
- [x] T20 — Rediseñar tiradores de redimensionamiento con 4 esquinas L-bracket blancas y barras intermedias estilo Windows Snipping Tool.
- [x] T21 — Barra de selección compacta de ancho mínimo (~120px) con menú desplegable de modos (Rectángulo, Ventana, Pantalla completa, Forma libre).
- [x] T22 — Selector de colores / Cuentagotas (Eyedropper): badge flotante con muestra, hex y rgb, y copia directa de #HEX al portapapeles con un clic.
- [x] T23 — Guardado automático directo en disco (Ctrl+S / botón Guardar) con fecha y hora en carpeta configurable (por defecto `Imágenes\Capturas`) sin diálogos repetitivos.
- [x] T24 — Registrar en ROADMAP.md el Extractor de Texto (OCR) y la Grabadora de Vídeo de Pantalla.
- [x] T25 — Cuadro de texto interactivo in-situ: selección de marco arrastrando o por clic, edición directa sin diálogos emergentes, controles de confirmación/cancelación y renderizado multilínea.
- [x] T26 — Barra de selección superior en una sola fila refinada (`is-refined-row`): Rectángulo (`R`), Ventana (`V`), Pantalla completa (`F`), Forma libre (`Q`), Selector de color (`C`) con copia directa y cierre, y Cerrar (`Esc`).
- [ ] T10 — Actualizar documentación y roadmap al entregar; mantener pendiente cualquier aceptación o comprobación no realizada.

Las pruebas y sus resultados pertenecen a [VALIDATION.md](VALIDATION.md).


## Refinamiento del capturador — 2026-10-18

- [x] Reiniciar modo, herramienta, texto y gestos al comenzar una captura.
- [x] Mejorar iconos y orden; añadir círculo/elipse sin desplegable.
- [x] Corregir punta y cuerpo de flecha, incluidos trazos cortos.
- [x] Unificar marco segmentado y tiradores turquesa en ventana y rectángulo.
- [x] Conservar el original hasta cerrar para permitir ajustar el recorte.
- [x] Completar verificación funcional y adjuntar capturas de la app al chat.


## Detalles de interacción — 2026-10-19

- [x] Mayús mantiene proporción 1:1 para cuadrado y círculo; presionar/soltar durante el trazo actualiza la figura sin mover el puntero.
- [x] El marco recorta un lienzo de tamaño nativo, anclado a sus coordenadas, durante el redimensionamiento. No estira ni aplasta sus píxeles.
- [x] Pruebas geométricas y de interfaz con IPC simulado; compilación de interfaz.


## Atajos y memoria — 2026-10-19

- [x] Atajos para herramientas, colores, grosores y acciones existentes, mostrados al pasar el cursor.
- [x] Persistir el último modo de imagen confirmado sin heredar el selector de color ni anotaciones anteriores.
- [x] Respetar escritura y atajos nativos dentro de campos de texto.
- [x] Compilación, pruebas unitarias y comprobación de interfaz con IPC simulado.


## Modo Ventana roto y sesión obsoleta — 2026-10-19

- [x] Diagnosticar en la instancia Dev que el overlay puede quedarse con una sesión obsoleta (fase de anotación, selección clavada) cuando el evento `screen_capture://session-started` no llega, dejando el modo Ventana apuntando al primer objetivo listado (la barra de tareas).
- [x] Excluir del catálogo de objetivos las ventanas del sistema operativo: barra de tareas (`Shell_TrayWnd`), escritorio (`Progman`/`WorkerW`), «Experiencia de entrada de Windows», menús flotantes del SO y tooltips.
- [x] No preseleccionar ningún objetivo al abrir la captura: la selección aparece al situar el cursor sobre una ventana.
- [x] Resolver la ventana bajo el cursor con el hit-test del sistema operativo (`screen_capture_detect_window_at`), excluyendo solo el overlay y el editor para que el resto de ventanas de Prisma sigan siendo capturables.
- [x] Conservar la sesión vigente en el backend (`screen_capture_get_session`, `session_id` monótono) y resincronizar el overlay al montarse y al recuperar el foco, de modo que la captura no dependa del evento.
- [x] Corregir la detección de subregión: coordenadas de cliente reales de la ventana padre y descarte de ventanas propias por ancestro raíz.
- [x] Pruebas de regresión en Rust y validación en la instancia Dev de los modos Ventana, Rectángulo y Selector de color.


## Entrada con lápiz de tableta gráfica — 2026-10-19

- [x] Confirmar la causa real del fallo: el overlay escuchaba `mousemove`/`mousedown`/`mouseup`, y el lápiz de una tableta gráfica no genera eventos de ratón, solo de puntero (`pointerType: "pen"`). Por eso no había hover de ventana ni arrastre de rectángulo, mientras que el lienzo de anotación (que sí usa eventos de puntero) sí recibía el lápiz.
- [x] Migrar la selección a eventos de puntero (`onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`), que cubren lápiz, ratón y dedo.
- [x] No llamar a `preventDefault()` en `pointerdown`: suprimiría los eventos de clic compatibles y rompería los botones de la barra y la confirmación.
- [x] Añadir `touch-action: none` y `overscroll-behavior: none` al overlay para evitar el desplazamiento/zoom nativo al arrastrar con lápiz o dedo.
- [x] Sostener el estado del arrastre en refs (`dragStateRef`, `selectionRectRef`, `lassoPointsRef`): con el lápiz los eventos llegan mucho más rápido que con el ratón y el `pointerup` se ejecutaba antes de que React aplicase el último `setSelectionRect`, así que el rectángulo nunca se confirmaba.


## Overlay minimizado que no volvía a aparecer — 2026-10-19

- [x] Diagnosticar por qué la captura no se veía: la ventana del overlay quedaba minimizada (Windows la guarda en `-32000,-32000`), ignoraba `set_position`/`set_size` y `show()` no la restauraba, de modo que el atajo abría una sesión invisible.
- [x] Restaurar la ventana explícitamente con `unminimize()` antes de posicionarla y redimensionarla, tanto en el atajo global como en el comando `screen_capture_start`.

## Capturas sucesivas con lápiz — 2026-10-20

- [x] Reproducir el contacto bloqueado cuando falta `pointerup` y cambia el identificador del lápiz.
- [x] Recuperar el contacto principal y liberar capturas de puntero al perder foco, cancelar, cambiar de modo o iniciar otra sesión.
- [x] Invalidar recortes pendientes y evitar que una copia o un temporizador de guardado anterior cierre una sesión nueva.
- [x] Añadir regresiones persistentes de contacto y consultas de ventana a `tests/`.
- [x] Comprobar ciclos repetidos de lápiz, selección, dibujo, cancelación, foco y formatos de guardado; compilar frontend.
- [ ] Confirmar el comportamiento con el lápiz físico de Biglex.

### Reincidencia tras instalar

- [x] Acotar el fallo: botones de ambas barras responden; fallan los gestos de selección y anotación.
- [x] Preparar registro local optativo de eventos y estado del gesto en producción.
- [ ] Capturar la secuencia física que falla y corregir su causa.
- [ ] Repetir selección y anotación en capturas sucesivas de producción.
- [x] Corregir y probar el rechazo común de lápiz con `isPrimary=false`; preservar el rechazo de dedos secundarios/botón lateral.
- [x] Identificar la instancia real del fallo y distinguir claramente las ventanas del diagnóstico.
- [x] Limpiar lienzo, imagen y anotaciones al cerrar/cambiar de sesión; esperar al frontend antes de volver a mostrar el overlay.
- [x] Verificar la transición A → B, la carga diferida de imagen y el cierre nativo; Biglex confirma «el parpadeo ya está saneado».

## Parpadeo al cambiar de ventana — 2026-10-20

- [x] Reproducir la alternancia entre el catálogo de sesión y el objetivo nativo.
- [x] Mantener el marco hasta resolver el siguiente objetivo nativo; conservar subregiones durante el movimiento.
- [x] Evitar que eventos en la misma posición invaliden una consulta en curso.
- [x] Comprobar ventanas, subregiones y barra de tareas con ratón y lápiz simulados; compilar frontend.

## Atajo global que no respondía al arrancar — 2026-10-21

- [x] T27 — Diagnosticar por qué el atajo no respondía al iniciar Prisma: el registro vivía en un efecto del frontend y solo con `screenCaptureEnabled` activo; en la instalación de Biglex el atajo elegido («Impr Pant») está ocupado por la Herramienta Recortes y el fallo se descartaba en silencio.
- [x] T28 — Trasladar el registro del atajo al backend: se registra en `setup` al arrancar la aplicación y la preferencia se persiste en `screen_capture.json` (directorio de datos de la app, con perfil propio en Dev).
- [x] T29 — Corregir el estado reportado: `isRegistered` refleja la tecla realmente aceptada por el sistema; añadir `requestedShortcut`, `enabled` y `hasStoredPreference`.
- [x] T30 — Añadir reserva automática: si el atajo pedido está ocupado se activa «Mayús + Impr Pant» y se informa del conflicto; la preferencia del usuario se conserva para reintentarse en cada arranque.
- [x] T31 — Transferir una sola vez la preferencia heredada del `localStorage` al backend.
- [x] T32 — Mostrar el estado real en Configuración (línea de estado bajo el interruptor) y en la vista «Capturador», que vuelve a la barra lateral bajo Herramientas; adaptar los botones al tema de la aplicación.
- [x] T33 — Verificar en la instancia Dev: registro al arranque sin abrir ninguna vista, respuesta del atajo con la aplicación minimizada, conflicto con «Impr Pant» ocupado, persistencia y reinicio.
- [ ] T34 — Comprobar la captura desde la instalación compilada por Biglex (requiere reconstruir e instalar; no realizado en este ciclo).

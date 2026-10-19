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

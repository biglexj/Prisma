# Capturador de pantalla — Tareas

- Estado: `IN_PROGRESS` — implementación base completada; verificada en TypeScript y Rust.
- Contrato funcional y decisiones: [PLAN.md](PLAN.md).

## Ejecución

- [x] T01 — Revisar instrucciones y cambios locales en `preview`; identificar atajos, ventanas auxiliares, permisos y servicios de imagen reutilizables.
- [x] T02 — Prototipar captura visible y detección de ventana/subregiones con contorno exacto; resolver límites de interfaces que no exponen controles y la exclusión de las capas del capturador.
- [x] T03 — Implementar sesión y geometría compartida: monitores, DPI, regiones, límites, cancelación y liberación de recursos.
- [x] T04 — Implementar modos Ventana por defecto, Rectángulo ajustable y Pantalla completa del monitor seleccionado.
- [x] T05 — Crear editor compacto en ventana propia: texto, lápiz, resaltador, borrado, deshacer/rehacer y composición a resolución original en memoria.
- [x] T06 — Integrar copia de imagen sin disco y Guardar como PNG mediante diálogo; conservar la sesión ante cancelación o error.
- [x] T07 — Añadir Capturador a navegación, catálogo de herramientas, preferencias y títulos; integrar apertura de editor y comportamiento de barra de tareas/foco.
- [x] T08 — Registrar atajo global configurable (propuesta Mayús + Impr Pant; alternativa Impr Pant), conflictos, desactivación y prevención de sesiones duplicadas.
- [ ] T09 — Corregir los fallos encontrados en VALIDATION.md y registrar límites reales de la detección automática.
- [ ] T10 — Actualizar documentación y roadmap al entregar; mantener pendiente cualquier aceptación o comprobación no realizada.

Las pruebas y sus resultados pertenecen a [VALIDATION.md](VALIDATION.md).

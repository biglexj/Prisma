# Procesos de Prisma

Cada trabajo planificado vive en `active/YYYY-MM-DD_objetivo/` y contiene:

- `PLAN.md`: definición y alcance.
- `TASKS.md`: ejecución técnica.
- `VALIDATION.md`: comprobaciones reproducibles.
- `APPROVAL.md`: decisión final.

Los moldes locales para crear un proceso nuevo se encuentran en `templates/`. Copia los cuatro archivos dentro de la nueva carpeta de `active` y reemplaza sus variables.

Usa las plantillas oficiales de la Documentación Core y actualiza `ROADMAP.md` al cerrar el trabajo.

- Validado, aprobado y cerrado → mueve la carpeta completa a `completed/YYYY/`.
- Cancelado, descartado, sustituido o cerrado incompleto → mueve la carpeta completa a `archive/YYYY/` y registra el motivo.
- Pausado temporalmente → conserva el proceso en `active` y documenta el bloqueo.

No copies el proceso: muévelo completo. Los procesos cerrados se conservan como referencia histórica y no se reescriben para trabajos futuros.

No crees un `TASKS.md` en la raíz del proyecto.

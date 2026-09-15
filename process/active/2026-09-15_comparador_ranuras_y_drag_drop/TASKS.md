# Proceso: Comparador de Imágenes con Ranura de Espera y Drag & Drop Nativo — Tareas

- Proceso: `2026-09-15_comparador_ranuras_y_drag_drop`
- Estado: `COMPLETED`

## Tareas

- [x] **Tarea 1 — Creación del Componente de Ranura Vacía (`ImageComparisonEmptySlot.tsx`)**:
  - [x] Diseñar tarjeta interactiva de Slot B con zona de soltado amplia.
  - [x] Botones para «Biblioteca» y «Explorador».
  - [x] Manejo de eventos drag & drop (Tauri nativo y HTML5).

- [x] **Tarea 2 — Creación del Modal Compacto de Selección de Fuente (`ImageComparisonSourceModal.tsx`)**:
  - [x] Modal emergente intermedio al pulsar «+ Añadir foto» o «Cambiar».
  - [x] Replicar la tríada: Área de arrastre, botón Biblioteca y botón Explorador.
  - [x] Cierre automático tras selección o soltado de archivo.

- [x] **Tarea 3 — Adaptación y Drag & Drop en `ImageComparisonModal.tsx`**:
  - [x] Modificar inicialización: no emparejar fotos arbitrarias automáticamente, iniciar con Slot B vacío.
  - [x] Integrar escucha a eventos nativos de Tauri v2 (`prisma://native-drag-drop`, etc.) coordinados con el viewport.
  - [x] Integrar `ImageComparisonSourceModal` como paso previo al selector de cuadrícula.
  - [x] Soporte de reemplazo por arrastre en mitades activas (Izquierda = A, Derecha = B).

- [x] **Tarea 4 — Soporte de Arrastre en `ImageComparisonSelector.tsx` y Blindaje en `useGlobalFileDrop.ts`**:
  - [x] Escuchar eventos nativos en el modal de biblioteca.
  - [x] Proteger `useGlobalFileDrop.ts` para que no intercepte imágenes sueltas en el comparador.

- [x] **Tarea 5 — Estilos M3 Expressive (`image-comparison.css`)**:
  - [x] Animaciones y bordes tonales para la ranura vacía y el modal de fuente.
  - [x] Efectos visuales de arrastre activo (`is-drag-over`).

- [x] **Tarea 6 — Verificación y Compilación**:
  - [x] Validar con `bun run build` (código 0, 0 errores TS).
  - [x] Registrar evidencias en `VALIDATION.md` y preparar `APPROVAL.md`.

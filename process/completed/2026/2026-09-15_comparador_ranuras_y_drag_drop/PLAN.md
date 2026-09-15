# Proceso: Comparador de Imágenes con Ranura de Espera y Drag & Drop Nativo Integral

- Proceso: `2026-09-15_comparador_ranuras_y_drag_drop`
- Fecha: `2026-09-15`
- Solicitante: `biglexj`
- Estado: `PROPOSED`

## Diagnóstico y Visión del Usuario

1. **Auto-emparejamiento no deseado al abrir el comparador**:
   - Actualmente, al pulsar "Comparar" desde una imagen en el visor, el sistema busca automáticamente la siguiente imagen disponible en la carpeta (`itemsList`) y la asigna a la Imagen B.
   - **Comportamiento esperado**: La comparativa debe iniciar con la Imagen 1 cargada en el Slot A (Base/Referencia) y el Slot B **vacío**, esperando la acción deliberada del usuario.

2. **Panel de Espera Interactivo en Slot B (Estilo Buscador de Duplicados)**:
   - Al estar el Slot B vacío en modo Lado a Lado (Split), debe mostrar una tarjeta interactiva espaciosa con tres opciones directas:
     - **Zona Drag & Drop**: *"Arrastra una imagen aquí..."* con respuesta visual y soporte nativo de Tauri v2 (`prisma://native-drag-drop`).
     - **Botón «Biblioteca»**: Abre el selector visual de miniaturas (`ImageComparisonSelector`).
     - **Botón «Explorador»**: Invoca directamente el diálogo de archivos del sistema operativo (`open()`) sin pasar por el selector de la biblioteca.

3. **Modal Compacto al Añadir o Cambiar Fotos («Añadir imagen a la comparativa»)**:
   - Cuando la comparativa ya tiene fotos y el usuario pulsa `+ Añadir foto` (barra superior), `Cambiar` en los encabezados de Imagen A / Imagen B, o `+ Añadir` en la tira de película inferior:
     - En lugar de saltar directamente al modal grande con la cuadrícula completa de miniaturas, se despliega un modal intermedio compacto y elegante (`ImageComparisonSourceModal`).
     - Este modal ofrece el mismo trío de acciones ergonómicas:
       1. Gran zona receptora: *"Arrastra una imagen aquí desde tu equipo"*.
       2. Botón *"Biblioteca"* ➔ Abre la cuadrícula de fotos.
       3. Botón *"Explorador"* ➔ Abre el diálogo nativo de Windows.
     - Al soltar un archivo sobre el modal, se asigna al instante y se cierra.

4. **Soporte Drag & Drop Universal en todo el módulo**:
   - Soporte nativo de arrastre de imágenes desde el explorador de Windows o el escritorio sobre:
     - La ranura vacía del Slot B.
     - El modal compacto de selección de fuente.
     - El selector de biblioteca (`ImageComparisonSelector`).
     - El visor comparativo activo (soltar en la mitad izquierda reemplaza Imagen A; en la mitad derecha reemplaza Imagen B).
   - Prevención de conflicto con `useGlobalFileDrop.ts` para que no trate la imagen soltada como una "carpeta de biblioteca".

## Arquitectura de Componentes

1. **`src/features/visual_library/ui/comparison/ImageComparisonEmptySlot.tsx`** [NUEVO]:
   - Componente de tarjeta de ranura vacía para Slot B.
   - Renderiza el área punteada con feedback visual al arrastrar (`is-drag-over`), icono ilustrativo, título *"Arrastra una imagen aquí"*, y botones estilizados *"Biblioteca"* y *"Explorador"*.

2. **`src/features/visual_library/ui/comparison/ImageComparisonSourceModal.tsx`** [NUEVO]:
   - Modal compacto y centrado de Material 3 Expressive.
   - Admite `mode: 'add' | 'replace'`, identifica si se reemplaza A o B, y provee la zona de soltado + botones de acceso rápido.

3. **`src/features/visual_library/ui/comparison/ImageComparisonModal.tsx`** [MODIFICAR]:
   - Inicializar `slots` solo con `initialItem` (a menos que `secondItem` se pase explícitamente).
   - Eliminar auto-apertura del selector si `slots.length < 2`.
   - Si `slots.length < 2`, renderizar en el panel derecho `ImageComparisonEmptySlot`.
   - Conectar los eventos nativos de soltado de Tauri (`prisma://native-drag-drop`, `prisma://native-drag-enter`, `prisma://native-drag-leave`, `prisma://native-drag-over`) con detección de zonas de colisión.
   - Reemplazar las aperturas directas del selector por el modal intermedio `ImageComparisonSourceModal`.

4. **`src/features/visual_library/ui/comparison/ImageComparisonSelector.tsx`** [MODIFICAR]:
   - Añadir escucha a eventos de soltado nativo para que si el usuario abre este modal y decide arrastrar una foto, sea aceptada y seleccionada inmediatamente.

5. **`src/app/hooks/useGlobalFileDrop.ts`** [MODIFICAR]:
   - Excluir o pausar el hook si el comparador de imágenes o sus modales están presentes en el DOM.

6. **`src/features/visual_library/ui/comparison/image-comparison.css`** [MODIFICAR]:
   - Estilos M3 Expressive para la tarjeta vacía de Slot B, efectos de borde brillante al hacer hover/drag-over, y diseño del modal compacto de fuente.

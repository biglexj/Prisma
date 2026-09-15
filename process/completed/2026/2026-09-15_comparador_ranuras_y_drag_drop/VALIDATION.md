# Validación: Comparador de Imágenes con Ranura de Espera y Drag & Drop Nativo

- Proceso: `2026-09-15_comparador_ranuras_y_drag_drop`
- Estado: `PASSED`
- Fecha de validación: `2026-09-15`

## Evidencias de Compilación

```
$ tsc --noEmit && vite build
vite v7.3.6 building client environment for production...
transforming...
✓ 230 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.16 kB │ gzip:   0.60 kB
dist/assets/index-DVHfoIP4.css  521.35 kB │ gzip:  77.77 kB
dist/assets/index-Bc2t0vxS.js   947.83 kB │ gzip: 251.75 kB
✓ built in 2.70s
```
- Resultado: **Exit Code 0** (0 errores de TypeScript, 0 errores de empaquetado Vite).

## Validaciones Funcionales

1. **Estado Inicial sin auto-emparejamiento**:
   - Al abrir el comparador desde una imagen, la Imagen A se mantiene intacta como base y el Slot B aparece como ranura vacía con la tarjeta interactiva de espera.
2. **Tarjeta de Espera Slot B**:
   - Dispone de zona activa de soltado nativo (`prisma://native-drag-drop`), botón «Biblioteca» para abrir la galería de miniaturas y botón «Explorador» para abrir el selector nativo del sistema operativo.
3. **Modal Compacto de Fuente**:
   - Al pulsar «+ Añadir foto» o «Cambiar», emerge el modal intermedio centrado con la misma tríada: área de soltado, Biblioteca y Explorador.
4. **Drag & Drop Universal**:
   - Funciona sobre la ranura vacía, sobre el modal compacto de fuentes, sobre el selector de biblioteca (`ImageComparisonSelector`) y en caliente sobre los paneles activos para reemplazar A o B.
5. **Blindaje de soltado global**:
   - `useGlobalFileDrop.ts` ignora eventos de soltado cuando el comparador de imágenes o sus modales están en el DOM, previniendo la creación errónea de carpetas de biblioteca.


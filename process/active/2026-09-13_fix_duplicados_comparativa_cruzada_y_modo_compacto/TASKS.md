# Tareas: Fix Buscador de Duplicados — Comparativa Cruzada Estricta y Modo Compacto

- [x] 1. Backend Rust: Comparativa cruzada estricta en `visual_library/duplicates.rs` <!-- id: 0 -->
  - [x] Implementar helper de clasificación `classify_path` (Base / Target / Neither)
  - [x] En coincidencia exacta (Nivel 1), descartar grupos intra-carpeta y emitir solo grupos con Base como original y Target como duplicados
  - [x] En similitud perceptual dHash (Nivel 2), comparar únicamente elementos de Base contra Target
- [x] 2. Backend Rust: Replicar lógica en `music_library/duplicates.rs` <!-- id: 1 -->
  - [x] Adaptar coincidencia exacta para modo cruzado
  - [x] Adaptar similitud perceptual de metadatos/duración para comparar Base contra Target
- [x] 3. Frontend React & CSS: Modo compacto de selección de 2 carpetas <!-- id: 2 -->
  - [x] Actualizar `DuplicatesScannerModal.tsx` para renderizar barra compacta dual cuando ambas carpetas estén seleccionadas
  - [x] Añadir soporte de Drag & Drop y cambio directo en la barra compacta
  - [x] Estilizar en `duplicates-scanner.css` con diseño Material 3 Expressive de alto contraste y ahorro vertical
- [x] 4. Verificación y Validación <!-- id: 3 -->
  - [x] Validar compilación TypeScript (`bun run check` -> OK, código 0)
  - [x] Validar compilación Rust (`cargo check` -> OK, código 0)
  - [x] Registrar evidencias en `VALIDATION.md` y decisión en `APPROVAL.md`

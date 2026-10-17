# Soporte Nativo para Formatos ElyX (.elx) y JPEG XL (.jxl) en Prisma — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobar decodificación unitaria en Rust de muestras de control `rgb_1_1_s1.elx`, `rgb_17_13_s1.elx`, `rgb_65_71_s1.elx` y rechazo de archivos truncados o corruptos.
- [ ] V02 — Agente — Decodificar `Peyto_s1.elx` (modo sin pérdida) y verificar que el SHA-256 de los píxeles coincide exactamente con la cabecera del archivo.
- [ ] V03 — Agente — Decodificar `Peyto_s8.elx` y generar vista previa sin artefactos de teselas o desbordamientos numéricos.
- [ ] V04 — Agente — Decodificar `jxl_q70.jxl` mediante el motor FFmpeg/libjxl y generar data URL válida.
- [ ] V05 — Agente — Verificar compilación de Rust (`cargo check`) y TypeScript (`bun run build` o `npx tsc --noEmit`) sin errores.
- [ ] V06 — Tester — Abrir una carpeta que contenga archivos `.elx` y `.jxl` en Prisma; verificar que aparecen con sus miniaturas en la vista de Biblioteca Visual.
- [ ] V07 — Tester — Abrir una imagen `.elx` en el visor interactivo (`ImageViewer`), aplicar zoom y paneo a resolución completa.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.

# Validación

- [x] Pruebas Bun de arrastre mouse/lápiz y destinos de Synapse: 14 correctas, 0 fallos (incluye cuatro pruebas duplicadas por coincidencia con una copia en temp).
- [x] `bun run build`: TypeScript y Vite correctos; aviso de tamaño de chunks.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml features::wallpapers::startup::tests --lib`: compilación nativa correcta, tres pruebas correctas (estabilidad, pérdida del shell y cancelación al cerrar).
- [x] `git diff --check`: sin errores de espacios; solo avisos de conversión LF/CRLF.
- [ ] Probar arrastre real con la tableta y el controlador utilizado por Biglex.
- [ ] Probar un inicio de Windows y confirmar el tamaño del fondo sin detenerlo manualmente.

No se ha reemplazado el ejecutable instalado. La espera es una mitigación de la inicialización, no prueba de que Windows sea la causa exacta. No implementa recuperación automática de un render defectuoso que ocurra después de la espera.

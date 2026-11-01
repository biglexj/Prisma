# Validación

- [x] `bun test tests/public-lyrics.test.ts`: 8 pruebas, 34 aserciones. Consultas sin identidad, versiones separadas, fallo no JSON, cancelación, persistencia/idempotencia/comprobante, fallo de almacenamiento, validación de LRC, procedencia y 429.
- [x] `bun run build`: TypeScript y Vite aprobados. Aviso de chunks superiores a 500 kB; sin errores.
- [x] Lectura real del endpoint público: búsqueda HTTP 200 y respuesta de candidatos con grabaciones. La documentación del proveedor aún decía pendiente de activación; se comprobó el estado efectivo.
- [x] CORS para `Origin: http://tauri.localhost`: HTTP 200 con `access-control-allow-origin` correspondiente.
- [x] Navegador: editor real montado en fixture local aislada, consulta de Veneno de Amor / Antología, candidato de catálogo, revisión de Original y carga explícita en el borrador con tiempos. El borrador local permaneció intacto hasta confirmar la aplicación. No se pulsó Guardar letras.
- [ ] Prueba nativa de guardado LRC/tags/SRT, reapertura offline y sincronización escuchada. El navegador no acredita la ejecución Tauri ni la correspondencia de los tiempos con un audio local.
- [ ] Recepción y aprobación de un aporte real: se verificó con respuestas HTTP simuladas, sin enviar contenido de prueba a producción.

Se conservan cambios concurrentes ajenos al alcance en arrastre nativo, Vite y sus pruebas. Sin publicación ni despliegue.

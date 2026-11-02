# Validación

## Ampliación: aportes automáticos y auditoría por identidad

- Las claves de reintento e historial quedan separadas por identidad; un fallo de sesión no se convierte silenciosamente en envío anónimo.
- Los recibos muestran publicación o asociación según `status` y `resolution`; HTTP 202 no se interpreta como publicación por sí solo.
- `bun test tests/public-lyrics.test.ts tests/track-lyrics-match.test.ts`: 11 pruebas y 45 aserciones aprobadas. Build TypeScript/Vite aprobado.
- La publicación automática nueva/coincidente está implementada en el proveedor local, pendiente de despliegue; no se han enviado aportes de prueba a producción.

- [x] `bun test tests/public-lyrics.test.ts`: 8 pruebas, 34 aserciones. Consultas sin identidad, versiones separadas, fallo no JSON, cancelación, persistencia/idempotencia/comprobante, fallo de almacenamiento, validación de LRC, procedencia y 429.
- [x] `bun run build`: TypeScript y Vite aprobados. Aviso de chunks superiores a 500 kB; sin errores.
- [x] Lectura real del endpoint público: búsqueda HTTP 200 y respuesta de candidatos con grabaciones. La documentación del proveedor aún decía pendiente de activación; se comprobó el estado efectivo.
- [x] CORS para `Origin: http://tauri.localhost`: HTTP 200 con `access-control-allow-origin` correspondiente.
- [x] Navegador: editor real montado en fixture local aislada, consulta de Veneno de Amor / Antología, candidato de catálogo, revisión de Original y carga explícita en el borrador con tiempos. El borrador local permaneció intacto hasta confirmar la aplicación. No se pulsó Guardar letras.
- [ ] Prueba nativa de guardado LRC/tags/SRT, reapertura offline y sincronización escuchada. El navegador no acredita la ejecución Tauri ni la correspondencia de los tiempos con un audio local.
- [ ] Recepción y aprobación de un aporte real: se verificó con respuestas HTTP simuladas, sin enviar contenido de prueba a producción.

Se conservan cambios concurrentes ajenos al alcance en arrastre nativo, Vite y sus pruebas. Sin publicación ni despliegue.

## Corrección de integración en la vista de reproducción

- Se comprobó que la vista solo consultaba archivos locales, mientras la búsqueda remota estaba dentro del editor. Prisma Dev tenía los servicios conectados desactivados; el editor mostraba por ello el aviso de activación.
- La canción de la captura, «Y Que Pasó» / «La bella luz», existe públicamente como «Y Que Pasó» / «Orquesta La Bella Luz» y contiene texto y una grabación. Consulta real, sin modificar catálogo.
- La vista y pantalla completa ahora consultan Biglex J en ausencia de letra local y con los servicios activos, muestran texto de coincidencia única y ofrecen selección de grabación. No se adopta sincronización automáticamente.
- El editor abre la búsqueda desplegada; los estados desactivados ofrecen activación visible sin modificar la preferencia automáticamente.
- `bun test tests/public-lyrics.test.ts tests/track-lyrics-match.test.ts`: 11 pruebas, 43 aserciones, aprobadas. `bun run build`: aprobado.
- Navegador, componente real LyricsPreview con metadatos de la captura: muestra «Fuente: Biglex J» y texto sin abrir el editor. Al elegir Original cambia a letras sincronizadas; Editar letra recibe el contenido con tiempos. No se guardaron archivos ni se cambió la preferencia de la instancia nativa del usuario. Evidencia: `prisma-letras-consulta.png` en los artefactos de la sesión.

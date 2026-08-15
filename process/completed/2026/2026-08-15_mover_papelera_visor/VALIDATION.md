# Validación: Mover a la Papelera de Reciclaje

## Criterios de Calidad

| Escenario | Comportamiento Esperado | Estado |
|---|---|---|
| Visor de Imágenes: Tecla Supr con confirmación activa | Muestra el modal `ConfirmDialog` centrado sobre el visor. Al confirmar, envía a papelera y avanza. | ✅ Validado |
| Visor de Imágenes: Tecla Supr con confirmación desactivada | Envía la imagen directamente a la papelera del SO sin abrir modal y avanza a la siguiente foto. | ✅ Validado |
| Visor de Imágenes: Clic derecho | Despliega menú contextual con "Mover a la papelera", "Mostrar en carpeta" y "Favoritos". | ✅ Validado |
| Visor de Imágenes: Botón en barra superior | Icono de papelera que lanza la eliminación según configuración. | ✅ Validado |
| Reproductor de Vídeo: Tecla Supr con confirmación activa | Muestra el modal `ConfirmDialog`. Al confirmar, envía el vídeo a papelera y pasa al siguiente. | ✅ Validado |
| Reproductor de Vídeo: Tecla Supr con confirmación desactivada | Envía el vídeo directamente a la papelera y pasa al siguiente sin interrupción ni modal. | ✅ Validado |
| Reproductor de Vídeo: Clic derecho | Despliega menú contextual con "Mover a la papelera", "Mostrar en carpeta" y "Favoritos". | ✅ Validado |
| Reproductor de Vídeo: Botón en barra superior | Icono de papelera en cabecera para mover a papelera directamente. | ✅ Validado |
| Bibliotecas (Música/Imágenes/Vídeos) | Mover a la papelera coherente y sin errores. | ✅ Validado |
| Compilación TypeScript & Rust | 0 errores de compilación (`bun run build` y `cargo check` pasados). | ✅ Validado |

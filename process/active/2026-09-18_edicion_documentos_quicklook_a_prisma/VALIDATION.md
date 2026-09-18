# Validación — Delegación de Edición de Documentos desde QuickLook a Prisma

## Criterios de Aceptación
1. Al pulsar el botón de edición (`[✏️]`) en la cabecera de QuickLook con un archivo Markdown o de texto abierto, QuickLook se cierra limpiamente y la ventana principal de Prisma pasa al frente abriendo el documento en modo edición (`split` para Markdown, `code` para texto).
2. Si el archivo está vacío (0 bytes), el editor muestra el cursor activo en el área de texto con placeholder *"Escribe o pega texto aquí... (Ctrl+S para guardar)"*. El usuario puede pegar contenido con `Ctrl+V` o escribir inmediatamente.
3. Al pulsar `Ctrl+S` o hacer clic en "Guardar cambios", el archivo se persiste en disco y se actualiza el estado.
4. En QuickLook, la vista previa de un archivo vacío muestra un botón de llamada a la acción *"Editar en Prisma"*.
5. Tanto `cargo check` como `bun run build` compilan con 0 errores.

## Registro de Comprobaciones
- Compilación Rust (`cargo check`): ✅ Completado exitosamente sin errores (`Finished dev profile in 1.18s`).
- Compilación Frontend (`bun run build` -> `tsc --noEmit && vite build`): ✅ Completado exitosamente en 3.40s.
- Verificación de límites de archivo: ✅ `App.tsx` verificado en 1214 líneas (dentro de los límites de las reglas de arquitectura).

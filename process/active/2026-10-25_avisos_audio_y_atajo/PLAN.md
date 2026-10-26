# Aviso flotante del audio y Shift+T

Biglex confirma que el envío global funciona y pide el aviso de Prisma centrado arriba sobre las demás aplicaciones; también informa que Shift+T dejó de alternar el envío local.

Alcance: sustituir el aviso de Windows por una ventana OSD transparente, sin foco, sin interacción y con cierre automático; conservar el aviso interior si Prisma tiene foco. Alternar el audio local según el estado real del backend y capturar Shift+T antes de los componentes, respetando campos editables, composición y repetición. Conservar todos los cambios previos de preview.

Validación: pruebas del teclado, TypeScript, Rust y compilación Tauri. La apariencia sobre otras aplicaciones y el sonido requieren comprobar la compilación actual, no la instancia instalada anterior. No publicar ni reemplazar la instalación.

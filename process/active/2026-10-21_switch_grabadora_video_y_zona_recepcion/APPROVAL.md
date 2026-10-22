# Alcance autorizado

Biglex pide, en este orden: un commit local que marque el inicio de un nuevo paradigma; un switch tipo Recortes para la grabadora de vídeos; y una zona de recepción en la parte superior central —unos 50 px de ancho por 2 o 3 px de alto, visible— donde arrastrar cualquier archivo desde el Explorador dispare una animación de recepción y use el sistema de transferencias con Super Galería como función número dos. Pide además identificar qué más se puede añadir.

Implementación autorizada por esa solicitud, sin publicación, sin cambio de versión y sin tocar el trabajo en curso de otros agentes (instalador, audio relay, historial y favoritos, Quick Look y tema): el commit de resguardo incluye únicamente la línea de captura.

Decisiones tomadas al implementar, con criterio propio y sujetas a la revisión de Biglex:

- La captura de vídeo se delega en el FFmpeg que ya viaja con Prisma, en vez de añadir dependencias o binarios nuevos al proyecto.
- La grabación arranca sin audio del sistema: el audio opcional es el dispositivo DirectShow que elija el usuario (micrófono o cable de audio). El bucle WASAPI del sistema queda para una entrega posterior.
- El panel de control de la grabación vive en la ventana principal, no en el overlay, porque el overlay debe ocultarse durante la captura.
- El cambio de intención se recuerda entre sesiones, igual que el último modo de captura.

Validación visual final en la aplicación pendiente de Biglex.

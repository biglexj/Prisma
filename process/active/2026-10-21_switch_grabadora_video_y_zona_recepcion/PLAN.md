# Switch de grabadora de vídeo y zona de recepción de archivos

Nuevo paradigma del capturador: un conmutador **Imagen | Vídeo** al estilo de Recortes de Windows y una zona de recepción en la parte superior central que envía cualquier archivo arrastrado desde el Explorador al sistema de transferencias de Super Galería.

El conmutador comparte el overlay de selección existente: en modo vídeo, confirmar la región inicia la grabación en lugar de congelar una imagen. La captura de vídeo se delega en el FFmpeg que ya viaja con Prisma (GDIGRAB), sin dependencias ni binarios nuevos.

Zona de recepción: muesca discreta de ~50 × 3 px en el borde superior central, siempre visible. Cuando entra un archivo arrastrado se despliega con animación de recepción y, al soltarlo, el archivo viaja por el sistema de transferencias hacia Super Galerie.

Decisiones de Biglex en esta sesion: switch tipo Recortes para la grabadora de videos; zona superior central visible de 50 px de ancho por 2-3 px de alto, con animacion de recepcion y uso del sistema de transferencias con Super Galeria como funcion numero dos.

# HEIC y formatos de imagen con extensión incorrecta

Biglex solicita compatibilidad con las imágenes HEIC de Pictures/TikTok que llevan extensión PNG y no se ven en Quick Look ni en la aplicación completa.

Detectar contenido mediante ImageReader, usando FFmpeg incluido como alternativa cuando el decodificador Rust no lo admita. Reutilizar el mecanismo para miniaturas, carga de respaldo del visor y conversión nativa a PNG/JPEG. El navegador mantiene la carga directa para formatos compatibles; solicita una imagen PNG decodificada si falla.

Reconocer también las extensiones auténticas HEIC/HEIF en biblioteca, apertura externa, Quick Look, favoritos y conversor. No renombrar ni sobrescribir originales. Renderización de respaldo limitada a 4096 px por lado; miniaturas limitadas a 480 px. El conversor conserva resolución original cuando no se solicita redimensionamiento.

Comprobar el archivo real señalado por Biglex, generar resultados únicamente en directorios temporales de prueba y verificar que el contenido de origen no cambie. Compilar y comprobar ambos visores en una instancia local de desarrollo.

Solicitud adicional: mostrar un indicador circular de estilo Material con retardo mínimo de 1 segundo (a partir del segundo 1) para prevenir parpadeos en archivos de carga rápida en ambos visores, manteniéndolo mientras se decodifica el respaldo y presentando el error únicamente cuando se haya confirmado el fallo.

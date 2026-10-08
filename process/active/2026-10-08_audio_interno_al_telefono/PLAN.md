# Música de Prisma en el teléfono

Biglex confirma que el audio externo llega al teléfono, pero la música reproducida dentro de Prisma no. Corregir el enrutamiento dentro de la función de altavoz ya autorizada.

La captura global lee el endpoint virtual; MPV conservaba la salida física y excluía los endpoints virtuales. La sincronización existente solo intentaba usar el endpoint virtual cuando estaban habilitadas las salidas múltiples. La captura independiente también puede diferir de la salida física recordada.

Usar una única política de ruta para la reproducción interna: captura del puente cuando esté activo; endpoint configurado para el teléfono o predeterminado de Windows durante envío independiente; salida física recordada al desactivar el teléfono. Resolver MPV por ID WASAPI para evitar diferencias entre nombres originales y etiquetas visibles. Desactivar los filtros locales de MPV durante el paso por DSP global y restablecerlos al regresar a reproducción local, conservando su configuración.

Verificar selección de rutas, audio de MPV en loopback real y, cuando la sesión personal esté libre, envío al receptor normal de Super Galería. No usar instrumentación Android ni publicar una versión.

# Carátulas y metadatos musicales

## Objetivo y autorización

Biglex solicita implementar en Prisma el escaneo de carátulas, artistas, títulos y álbumes descrito en [Core](../../../../Docs/features/media/media-metadata-baseline.md), con acceso similar al descargador de letras. Solicitud del 2026-11-01; ejecución autorizada.

## Alcance

- Búsqueda integrada en el editor de etiquetas: acceso desde General, Carátula y la pestaña Buscar en línea. Los menús de canción/carpeta y la cabecera de carpeta abren el editor; se retira la herramienta independiente.
- Consultas HTTP desde Rust: iTunes primero; Deezer cuando falla/no devuelve resultados y bajo petición manual cuando las coincidencias no son útiles.
- Limpieza del ruido editorial conservando las versiones musicales para que se puedan distinguir.
- Revisión y selección explícita por canción, consulta editable y elección de campos. Desde Carátula solo se elige imagen inicialmente; desde General se ofrecen todos los campos. Permite reemplazar datos existentes y ofrece completar únicamente vacíos como opción.
- Carátula cuadrada validada y descargada en alta resolución; incrustación mediante el escritor de etiquetas existente y actualización de la caché visual.
- Límites de tiempo, tamaño, destinos de descarga y ritmo de consultas. Detención al finalizar la operación en curso.
- Las coincidencias y las imágenes descargadas se preparan en memoria. Solo Guardar cambios escribe etiquetas; Cancelar descarta el borrador. El lote conserva una propuesta distinta por archivo, con prevalencia de los campos comunes que el usuario rellene.

## Adaptación al escritorio

La persistencia es local, dentro del audio; las instrucciones de SeaweedFS/BD de Aurora no aplican. No se generan miniaturas de YouTube como sustituto ni se altera el nombre de los archivos. No se infieren colaboradores que el proveedor no devuelva. La primera coincidencia requiere revisión, no se considera verificada automáticamente.

## Finalización

Build frontend, comprobación Rust, pruebas de conservación de etiquetas y normalización, consulta real de ambos proveedores y descarga HD, prueba del flujo de interfaz con IPC simulado. La aceptación en Prisma nativo instalado se distingue de estas comprobaciones.

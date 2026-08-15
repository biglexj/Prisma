# Fase 3: fuentes de carpetas de música

## Objetivo

Permitir que la persona registre una o más carpetas raíz de música y que Prisma reconozca los archivos de audio contenidos en ellas y en sus subcarpetas.

Esta fase no construye todavía la biblioteca multimedia completa. Introduce únicamente el contrato mínimo de fuentes persistentes para música.

## Diferencia entre sesión y fuente

- Una sesión de carpeta nace al abrir un archivo y sirve para navegar temporalmente entre archivos compatibles de su carpeta inmediata.
- Una fuente de biblioteca es una carpeta raíz elegida explícitamente, persiste entre ejecuciones y se escanea recursivamente.
- Quitar una fuente elimina solo su registro en Prisma. Nunca borra, mueve ni modifica archivos del disco.

## Alcance

- Seleccionar una carpeta mediante el diálogo nativo.
- Validar y normalizar la ruta elegida.
- Escanear audio de forma recursiva fuera del hilo de interfaz.
- Omitir enlaces simbólicos para evitar ciclos.
- Registrar nombre, ruta, disponibilidad y cantidad de canciones.
- Persistir las fuentes en un documento JSON versionado dentro de los datos de la aplicación.
- Volver a escanear o quitar una fuente.
- Mostrar la lista ligera de canciones reconocidas y permitir abrir una en el reproductor existente.
- Mostrar carátulas bajo demanda, priorizando la imagen incrustada y usando después archivos comunes de portada de la carpeta.
- Mantener una caché limitada en memoria sin persistir las imágenes.

## Fuera de alcance

- Imágenes y vídeos como fuentes de biblioteca.
- SQLite o un índice multimedia permanente.
- Extracción de artistas, álbumes, duración u otras etiquetas distintas de la carátula.
- Favoritos, listas, letras, búsqueda y vigilancia automática del sistema de archivos.
- Borrado, movimiento o edición de archivos del usuario.

> Este límite describe la Fase 3. Imágenes y vídeos se incorporan después mediante el contrato separado documentado en `phase-4-visual-folders.md`; no se añadieron retroactivamente al modelo de música.

## Fronteras de implementación

- `features/music_library` decide qué constituye una fuente de música y cómo se representa el resultado del escaneo.
- `infrastructure/folder_sources` persiste el registro mediante JSON y puede sustituirse en el futuro.
- `app/commands` expone las operaciones a Tauri y ejecuta los escaneos bloqueantes fuera del hilo principal.
- La interfaz mantiene Inicio, Escuchar y Carpetas como vistas independientes.

## Criterios de validación

1. Añadir una carpeta la conserva después de reiniciar Prisma.
2. Los audios de subcarpetas aparecen como contenido reconocido.
3. Los archivos de imagen, vídeo y otros formatos se ignoran en esta fase.
4. Volver a escanear actualiza la cantidad de canciones.
5. Quitar una carpeta no modifica ningún archivo del disco.
6. Seleccionar una canción reconocida la abre en el coordinador de reproducción compartido.

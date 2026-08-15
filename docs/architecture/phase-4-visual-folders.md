# Fase 4: fuentes visuales y biblioteca multimedia

## Objetivo

Extender el contrato ligero de carpetas de música a imágenes y vídeos sin introducir todavía una base de datos ni un índice multimedia permanente.

Esta fase convierte Inicio en un panel multimedia real y habilita las secciones Imágenes y Vídeos. Cada sección conserva su propia responsabilidad, mientras el coordinador de reproducción continúa siendo único.

## Alcance implementado

- Registrar carpetas raíz independientes para imágenes y vídeos.
- Persistir únicamente ruta, nombre, familia, disponibilidad y conteo en un JSON versionado.
- Escanear subcarpetas fuera del hilo de interfaz.
- Ignorar enlaces simbólicos y carpetas ocultas durante el recorrido.
- Separar estrictamente imágenes y vídeos mediante el clasificador compartido de familias.
- Mostrar título, carpeta relativa, tamaño y fecha de modificación de cada elemento reconocido.
- Ordenar los medios visuales por modificación reciente.
- Cargar vistas previas de imágenes bajo demanda y mantener una caché limitada en memoria.
- Abrir imágenes en un visor ligero dentro de Prisma.
- Enviar vídeos al coordinador de reproducción existente y construir una sesión temporal de su carpeta inmediata.
- Integrar Música, Imágenes y Vídeos en Inicio sin mezclar sus reglas internas.
- Adaptar la navegación entre rail lateral y barra inferior según el espacio disponible.

## Decisiones de rendimiento

- La caché visual conserva un máximo pequeño de vistas previas.
- Una imagen superior a 6 MB no se serializa hacia el WebView; la tarjeta conserva su estado sustituto.
- Los vídeos no se convierten a datos base64 ni se precargan para evitar picos de memoria.
- La cuadrícula limita la cantidad de elementos montados y utiliza `content-visibility`.
- El filesystem continúa siendo la fuente de verdad; volver a entrar o reescanear actualiza el contenido visible.

## Persistencia

Las fuentes visuales viven en `visual-folders.json`, separado del registro histórico `music-folders.json`.

Una fuente se identifica mediante la combinación de:

- ruta canónica;
- familia visual: `image` o `video`.

Por ello, una misma carpeta mixta puede registrarse en ambas secciones sin duplicar elementos dentro de una misma familia.

## Vistas previas

Las imágenes compatibles se leen únicamente cuando su tarjeta se aproxima al área visible. La infraestructura valida el formato por firma antes de generar un `data URL` temporal.

Los vídeos muestran por ahora una tarjeta semántica ligera. Su ruta se abre con libmpv mediante el mismo coordinador usado por la música. La incrustación de la superficie nativa de vídeo continúa siendo un experimento específico de renderizado y no debe confundirse con la biblioteca ya funcional.

## Inspiración de Lienzo

La interfaz adopta patrones probados en Lienzo Gallery sin copiar su implementación Android:

- Inicio funciona como resumen reciente de todas las familias.
- Cada familia conserva una sección propia.
- Las tarjetas visuales usan formas expresivas y jerarquía de Material 3.
- La navegación cambia de rail a barra inferior según el ancho.
- La música deriva un color semántico de la carátula activa para ambientar el reproductor.

## Criterios de salida

1. Añadir, reescanear y quitar carpetas visuales nunca modifica los archivos del usuario.
2. Reiniciar Prisma conserva las fuentes de imágenes y vídeos.
3. Una carpeta mixta produce listas separadas y sin duplicados por familia.
4. Las imágenes visibles cargan su vista previa bajo demanda y se pueden ampliar.
5. Los vídeos reconocidos se pueden abrir en la sesión multimedia compartida.
6. Inicio refleja conteos y contenido reciente de las tres familias.
7. La navegación sigue disponible en ventanas estrechas mediante una barra inferior.
8. Las pruebas de Rust y la compilación de TypeScript finalizan correctamente.

## Siguiente fase

La Fase 5 debe validar el renderizado de vídeo integrado en una superficie nativa de Prisma, incluyendo redimensionamiento, pantalla completa, cierre limpio y aceleración por hardware. No requiere cambiar el contrato de fuentes creado aquí.

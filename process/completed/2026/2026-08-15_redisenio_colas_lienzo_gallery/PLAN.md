# Plan — Rediseño y Preservación de Colas (Estándar Lienzo--Gallery)

## Contexto y Diagnóstico
Prisma reemplazaba la cola activa al reproducir pistas desde la biblioteca o álbumes, provocando que listas personalizadas del usuario fueran sobreescritas o borradas. Además, faltaba el comportamiento secuencial de salto entre colas (`jumpToNextQueue`: A → B → C) y bucle cíclico (`loopQueues`: C → A) de `Lienzo--Gallery`.

## Objetivos
1. Preservar todas las colas personalizadas del usuario al reproducir desde la biblioteca, asegurando que la reproducción general siempre opere en la cola predeterminada (`DEFAULT_QUEUE_ID = "default_queue"`, `"Árbol de Música"`).
2. Implementar la navegación secuencial entre colas (`jumpToNextQueue`) y el ciclo continuo (`loopQueues`) exactos a `MusicPlaybackState.kt` de Lienzo-Gallery.
3. Incorporar controles de ordenación de colas (Subir / Bajar) en el panel de gestión de colas.
4. Exponer los conmutadores directos de `Salto cola` y `Bucle colas` en la cabecera de la cola.
5. Sanitizar la ruta en la vista de reproducción eliminando prefijos `\\?\`.

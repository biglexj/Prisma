# Auditoría de rendimiento multimedia de Prisma

- Estado: `AWAITING_APPROVAL`
- Fecha: `2026-08-14`
- Proyecto auditado: `D:\Proyectos\biglexj\Prisma`
- Proyecto de referencia: `D:\Proyectos\biglexj\Lienzo--Gallery`
- Implementación de código autorizada: `NO`

## Corrección de alcance

Prisma es el proyecto que presenta el consumo anormal de recursos y el único objetivo técnico de esta auditoría. Lienzo no se considera problemático: se usará únicamente como referencia de diseño, funciones, interacción y organización. No se copiarán dependencias ni código Android.

## Objetivo

Determinar si Prisma puede evolucionar, con su stack Tauri 2 + React + Rust + libmpv, hacia un visor y reproductor multimedia local minimalista capaz de cubrir el flujo principal de qView: apertura rápida, navegación sencilla y consumo contenido. La prioridad inmediata es corregir el uso de memoria durante la reproducción musical antes de ampliar imágenes, vídeo, miniaturas y árboles.

## Veredicto

- `VIABLE CON CONDICIONES`: el stack actual puede sostener el producto.
- `NO APTO TODAVÍA PARA REEMPLAZAR QVIEW`: aproximadamente 1 GiB al reproducir una canción contradice el objetivo minimalista.
- `NO REESCRIBIR TODAVÍA`: existen problemas concretos de caché y previews que deben corregirse antes de evaluar otro framework.
- `PROTECCIÓN PENDIENTE`: la raíz inspeccionada de Prisma no contiene un repositorio Git detectable. No se debe editar código hasta localizar la raíz Git real o aprobar un respaldo recuperable.

## Hallazgos

| Prioridad | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| P0 | Carátulas originales en base64 | `src-tauri/src/infrastructure/artwork/mod.rs` acepta hasta 8 MiB y no reduce dimensiones | Copia base64, imagen decodificada y textura pueden coexistir en WebView2 |
| P0 | Caché de 96 carátulas por canción | `src/features/music_library/useMusicArtwork.ts` usa la ruta de pista como clave | Duplica portadas compartidas por un álbum y retiene demasiados bytes |
| P0 | Caché de paletas ilimitada | `src/features/playback/ui/useAlbumPalette.ts` usa toda la data URL como clave | La cadena base64 continúa retenida incluso después de expulsarla de la primera caché |
| P1 | Biblioteca sin virtualización | `MusicLibrary.tsx` monta hasta 240 tarjetas | Mantiene demasiados nodos e imágenes decodificadas |
| P1 | Miniaturas de vídeo a resolución original | `VideoThumbnail.tsx` crea un canvas `videoWidth × videoHeight` | Vídeos 4K pueden provocar picos grandes de RAM y GPU |
| P1 | Configuración genérica de MPV | `mpv.rs` usa `vo=auto` y `keep-open=yes` también para audio | Puede conservar recursos de vídeo o carátula; falta confirmación mediante medición |
| P2 | Sondeo cada 500 ms | `usePlaybackController.ts` consulta mientras exista una ruta | IPC y CPU constantes, incluso en pausa |
| Positivo | Preview visual reducido | El backend de imágenes reduce a un máximo acotado y el frontend conserva 16 previews | Debe convertirse en el patrón común para música y vídeo |

## Hipótesis principal

La explicación de mayor confianza es esta cadena:

`carátula original → base64 → caché por canción → imagen decodificada → textura GPU → paletteCache indexada por la misma data URL`

MPV puede contribuir, pero no debe declararse culpable sin medir por separado el ejecutable de Prisma, WebView2 y cualquier proceso o memoria asociada al motor.

## Arquitectura recomendada

1. Conservar un solo coordinador de reproducción y un backend MPV por proceso.
2. Crear un contrato común de preview: identidad estable, ancho, alto, formato, bytes y origen.
3. Generar carátulas y miniaturas reducidas en Rust; no transportar originales o fotogramas completos como data URL.
4. Limitar cachés por bytes y por elementos, con LRU y deduplicación de solicitudes.
5. Identificar carátulas por álbum, archivo fuente o hash, nunca por la cadena base64 ni únicamente por cada canción.
6. Virtualizar listas y árboles; la cantidad de archivos no debe equivaler a la cantidad de componentes montados.
7. Medir biblioteca, previews y reproducción como subsistemas separados.

## Fases

### Fase 0 — Línea base y protección

- Localizar la raíz Git real o acordar un respaldo recuperable.
- Medir el árbol completo de procesos con build de producción.
- Probar inicio vacío, canción sin portada, portada grande, 100 cambios de pista y reproducción de 30 minutos.
- Registrar memoria privada, working set, GPU y CPU.

`G0`: requiere aprobación de Biglex antes de editar código.

### Fase 1 — Carátulas y paletas

- Reducir carátulas en Rust a un máximo provisional de 512 px.
- Reencodificar como WebP o JPEG y evitar originales longevos en base64.
- Deduplicar por identidad de portada o álbum.
- Aplicar un presupuesto inicial de 32 MiB a la caché.
- Reemplazar la clave data URL de `paletteCache` y limitarla.

`G1`: 100 cambios de pista deben alcanzar un techo estable de memoria.

### Fase 2 — Biblioteca y árboles

- Sustituir el montaje de 240 tarjetas por virtualización o ventana incremental.
- Cargar carátulas solo cerca del viewport.
- Cancelar solicitudes sin consumidores visibles.

`G2`: una biblioteca grande no debe montar ni decodificar el conjunto completo.

### Fase 3 — Vídeo

- Retirar el canvas a resolución original del frontend.
- Reutilizar el generador nativo acotado entre 320 y 480 px.
- Añadir deduplicación y caché por bytes.

`G3`: un vídeo 4K no debe producir un canvas 4K para una tarjeta.

### Fase 4 — MPV y ciclo de vida

- Comparar audio con y sin carátula y con salida de vídeo desactivada.
- Revisar `audio-display`, `vo`, `keep-open`, reemplazo de pista y cierre.
- Suspender o reducir el sondeo al pausar, ocultar o cerrar la vista.
- Confirmar que cerrar Prisma termina procesos y libera archivos.

`G4`: audio sostenido y cierre limpio deben cumplir el presupuesto.

### Fase 5 — Validación integral

- Ejecutar build frontend, pruebas Rust y build Tauri de producción.
- Repetir la matriz con los mismos archivos.
- Validar visualmente imágenes, música y vídeo.
- Decidir con métricas si Tauri queda aprobado o requiere un experimento comparativo.

## Presupuestos provisionales

Se debe sumar la memoria privada de todo el árbol de Prisma.

| Escenario | Objetivo inicial |
|---|---:|
| Inicio vacío estabilizado | ≤ 180 MiB |
| Una canción reproduciéndose | ≤ 260 MiB |
| Incremento al iniciar audio | ≤ 80 MiB |
| Audio durante 30 minutos | crecimiento ≤ 10 % y ≤ 30 MiB |
| Recorrer 200 portadas | pico ≤ 320 MiB y retorno a un techo estable |
| Vídeo 1080p | ≤ 550 MiB, sujeto a GPU y códec |

Estos valores son provisionales y deben ajustarse después de obtener la línea base real en la laptop de Biglex.

## Uso de Lienzo como referencia

Lienzo puede aportar identidad visual, jerarquía, componentes, navegación y comportamiento esperado. Prisma conservará su arquitectura Tauri/Rust/React. Cada reutilización debe describir el principio tomado y evitar un port directo de código Android.

## Restricciones para el agente ejecutor

- No editar código antes de `G0`.
- No cambiar de framework ni comenzar una migración.
- No guardar originales, vídeos o fotogramas completos en base64.
- No limitar imágenes solamente por cantidad; usar también presupuesto por bytes.
- Ejecutar una tarea a la vez y registrar evidencia en `VALIDATION.md`.
- No considerar un build exitoso como prueba de rendimiento o funcionalidad completa.
- Detenerse en cada puerta de aprobación.

## Decisiones solicitadas

- [ ] Aprobar el diagnóstico y autorizar únicamente la Fase 0.
- [ ] Aprobar o ajustar los presupuestos provisionales.
- [ ] Indicar la raíz Git real o autorizar un respaldo/checkpoint alternativo.


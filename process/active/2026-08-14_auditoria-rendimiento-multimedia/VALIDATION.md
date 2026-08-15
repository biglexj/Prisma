# Validación — Auditoría de rendimiento multimedia de Prisma

- Fecha: `2026-08-14`
- Estado: `STATIC_AUDIT_COMPLETE / RUNTIME_PENDING`

## Evidencia confirmada

- [x] Prisma es Tauri 2 + React 19 + Rust + libmpv.
- [x] El backend acepta carátulas originales de hasta 8 MiB y devuelve base64 sin reducción.
- [x] La caché musical conserva hasta 96 entradas por ruta de canción.
- [x] `paletteCache` no tiene límite y usa la data URL completa como clave.
- [x] La vista musical monta hasta 240 tarjetas sin virtualización.
- [x] Las miniaturas de vídeo usan canvas a resolución original.
- [x] El estado de reproducción se consulta cada 500 ms mientras exista una ruta.
- [x] MPV se inicializa con `vo=auto` y `keep-open=yes`.
- [x] Las pantallas se desmontan al navegar, pero las cachés de módulo sobreviven.
- [x] El pipeline visual de imágenes ya utiliza previews reducidos y una caché pequeña.
- [x] La raíz inspeccionada de Prisma no es un repositorio Git.

## Estado de pruebas

| Comprobación | Estado | Observación |
|---|---|---|
| Auditoría estática | Aprobada | Hallazgos reproducibles en el código actual |
| Build frontend actual | Pendiente | Debe ejecutarse antes de modificar código |
| Pruebas Rust actuales | Pendiente | No ejecutadas durante la auditoría estática |
| Build Tauri de producción | Pendiente | Obligatorio para medir memoria real |
| Reproducción de 30 minutos | Pendiente | Requiere los archivos reales de Biglex |
| Validación visual | Pendiente | No sustituible por compilación |

Los procesos históricos no sustituyen una ejecución actual. La auditoría tampoco atribuye todavía un porcentaje exacto del gigabyte a WebView2, las carátulas o MPV.

## Protocolo de medición

1. Cerrar aplicaciones pesadas y registrar la memoria libre inicial.
2. Ejecutar un build de producción.
3. Esperar 120 segundos antes de registrar cada estado estable.
4. Sumar la memoria privada de Prisma y sus procesos asociados.
5. Registrar CPU, memoria privada, working set y GPU cada minuto.
6. Usar los mismos archivos y el mismo orden antes y después.
7. Cerrar Prisma y confirmar que no queden procesos ni archivos bloqueados.

## Matriz mínima

| Caso | Duración | Resultado requerido |
|---|---:|---|
| Inicio vacío | 2 min | ≤ 180 MiB |
| Audio sin portada | 10 min | Estable y ≤ 260 MiB |
| Audio con portada pequeña | 10 min | Diferencia acotada |
| Audio con portada de 4–8 MiB | 10 min | Sin retención del original fuera del presupuesto |
| 100 pistas con una portada | 100 cambios | Una identidad de portada, sin crecimiento lineal |
| 100 portadas distintas | 100 cambios | Caché dentro del presupuesto por bytes |
| Audio sostenido | 30 min | Crecimiento ≤ 10 % y ≤ 30 MiB |
| Recorrido de 200 portadas | Completo | Pico ≤ 320 MiB y techo estable |
| 50 vídeos, incluidos 4K | Completo | Ningún canvas a resolución original |
| Cierre | 60 s | Cero procesos huérfanos |

## Evidencia obligatoria por tarea

- Comando exacto y checkpoint probado.
- Dataset y tamaños de archivos.
- Tabla o CSV de muestras antes y después.
- Captura del árbol de procesos y memoria GPU.
- Resultado de tests, build y revisión visual por separado.
- Explicación de cualquier presupuesto incumplido.


# Validación

## Estado inicial
El comparador sobrescribía los roles del tema con una paleta oscura fija, incluso en modo claro. La corrección hereda los roles existentes sin añadir un selector de tema independiente.

## Comprobaciones realizadas
- `gh release list`: última publicación 1.1.6. `git ls-remote --tags origin 'refs/tags/v1.1.7*'`: sin etiqueta. Se conserva 1.1.7.
- Revisión del frontend real en el navegador integrado: modo claro y oscuro, paleta verde y fondo azul, vista vacía a dos columnas, cuadrícula vacía y selector de biblioteca con filtros temáticos. Cortinilla y Alternar A/B solicitan primero dos elementos, como en la lógica existente.
- Claro: fondo del área `rgb(238, 242, 251)`, texto oscuro y botones con pares de contraste del tema. Oscuro: área `rgb(26, 27, 38)` y texto `rgb(192, 202, 245)`.
- Capturas en `temp/comparador-claro.png`, `temp/comparador-oscuro.png`, `temp/selector-comparador-claro.png` y `temp/selector-comparador-oscuro.png`.
- `bun test tests`: 41 pruebas correctas, 0 fallos, 111 aserciones, 8 archivos.
- `git diff --check`: correcto.
- Primera compilación de escritorio correcta, Tauri release + NSIS. La recompilación final también terminó correctamente y contiene el ajuste posterior de filtros (`index-D4pAbZSo.css`, comprobada la presencia de `.img-compare-kind-pills`). TypeScript, Vite y Rust correctos. Advertencia preexistente de tamaño del bundle web; no bloquea el empaquetado.
- Instalador final: `release/Prisma_1.1.7_x64-setup.exe`. Se verificó su coincidencia SHA-256 con el bundle nativo y la estabilidad de los tres archivos concurrentes durante la compilación. Tamaño, fecha, checksum y fuentes exactas registrados en `BUILD_MANIFEST.json`; archivo `.sha256` junto al instalador.
- Checkpoints locales: `2511cd1` (comparador/notas/proceso) y `636ee5f` (captura dedicada de volumen). Los tres cambios concurrentes de SMTC permanecen sin alterar ni incluir en esos commits.

## Límites de la evidencia
La revisión del navegador prueba la presentación con los componentes reales. No prueba la apertura nativa, el arrastre a otra aplicación ni la reproducción de archivos: esas operaciones requieren el entorno Tauri. No se ha instalado esta actualización ni se ha publicado.

Las pruebas físicas pendientes del ciclo anterior se mantienen: reconexión de salida secundaria, respuesta repetida del volumen en 0/100 y controles multimedia del sistema. Los cambios concurrentes de SMTC en Rust y React se conservan en el árbol de trabajo y se incluyen en la compilación local; su validación física y su checkpoint siguen pendientes. El backend concurrente mantiene SMTC deshabilitado; no se afirma que los controles multimedia nativos estén revalidados.

## Publicación posterior
El script de publicación existente contiene operaciones forzadas de Git. La preparación usa exclusivamente `-LocalOnly`, que sale antes de esa rama. Para publicar, primero reconciliar el snapshot, verificar de nuevo la versión remota y usar un flujo sin reetiquetado ni push forzado. La autorización de publicación sigue pendiente.

## Lanzamiento autorizado — 2026-10-01

- Se sustituye el flujo antiguo por preflight, push atómico sin forzado, etiquetas inmutables, comprobación del asset y sincronización mediante POST /api/admin/developer-app-releases.
- Preflight remoto correcto: 1.1.7 libre; Aurora identificada mediante su API pública; código siguiente 10107; acceso administrativo verificado sin exponer credenciales.
- Se incorporan los tres cambios concurrentes de SMTC que ya formaban parte del instalador preparado. Se mantiene pendiente su validación física y no se afirma que SMTC esté habilitado.
- La reutilización del instalador fue rechazada por diferencia de checksum y tamaño frente al manifiesto. Se recompila el snapshot revisado antes de publicar; el manifiesto se actualizará exclusivamente con el resultado de esa compilación.
- Pruebas repetidas tras reconciliar el snapshot: 41 correctas, 0 fallos, 111 aserciones, 8 archivos.
- El ejecutable local no tiene firma Authenticode; no hay certificado de firma configurado en el empaquetado vigente.

## Publicación confirmada — 2026-10-01

- Release estable: https://github.com/biglexj/Prisma/releases/tag/v1.1.7. Publicada a las 20:01:12 UTC; draft=false y prerelease=false.
- Etiqueta y ramas main/preview inicialmente apuntan al commit e9740f00530df35050c63cde95904a1e5a48ae0f. Push atómico sin forzado; no se reemplazó ninguna release previa.
- EXE público de 164294760 bytes, estado uploaded y digest GitHub SHA-256 4bca056371a7b9135a6e126b89d8c196b9ad0ba1f69c2bfd9c2c2273c3d86c50, igual al instalador local. HEAD de la URL pública: HTTP 200.
- Assets adicionales: Prisma_1.1.7_x64-setup.exe.sha256 y SHA256SUMS.txt.
- Aurora confirmó por API administrativa y pública versionName=1.1.7, versionCode=10107, status=published, URL del asset y checksum idénticos. El Markdown coincide íntegramente con RELEASE_MESSAGE.md y el cuerpo de GitHub.
- Página final https://www.biglexj.com/desarrollo/prisma verificada en el navegador real: versión v1.1.7, notas renderizadas, CTA Descargar EXE, instalador x64 y archivos de checksum. Captura temp/prisma-1.1.7-publicada.png.
- No se instaló el EXE ni se ejecutaron pruebas físicas de hardware en esta publicación. Se cierran preparación y lanzamiento con esos límites aceptados expresamente por Biglex; permanecen en los procesos de diagnóstico previos.
- Recompilación de lanzamiento terminada correctamente (TypeScript, Vite, Rust y NSIS). SHA-256: 4bca056371a7b9135a6e126b89d8c196b9ad0ba1f69c2bfd9c2c2273c3d86c50; bytes: 164294760. Bundle nativo y copia coinciden. CSS final index-D4pAbZSo.css.

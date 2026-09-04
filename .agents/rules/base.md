---
trigger: always_on
---

# Instrucciones del proyecto

Entrada única de instrucciones: `.agents/rules/base.md`.

Consultar [Docs](../../../Docs/README.md) como fuente compartida. Seleccionar únicamente estándares, perfiles y skills pertinentes al encargo. Conservar las reglas específicas de este proyecto; su código y configuración vigentes determinan el comportamiento real.

# Agent Instructions - Prisma

## Modelos de IA [CRÍTICO]
- La configuración ejecutable del proyecto es la fuente de verdad (`AI_MODELS.md` como registro explicativo si existe).
- Consulta `D:\Proyectos\biglexj\Docs\features\ai-models` para selección, migración y validación.
- Selecciona modelos por función, calidad comprobada, latencia, coste, privacidad y capacidades.
- No cambies silenciosamente de modelo o proveedor; valida compatibilidad y actualiza el registro local.

## Project License & Author
- **License**: MIT
- **Author**: biglexj (2026)

## Red de Agentes & Proyectos de Referencia [CRÍTICO]
- **Central del Ecosistema (`Agents`)**: `d:\Proyectos\biglexj\Docs/agents` ([00 - CORE.md](file:///d:/Proyectos/biglexj/Docs/agents/core/behavior.md), [03 - ECOSISTEMA.md](file:///d:/Proyectos/biglexj/Docs/agents/profiles/ecosystem.md)).
- **Documentación Core (`Docs`)**: `D:\Proyectos\biglexj\Docs` (Fuente oficial de estándares y plantillas; revisar siempre al iniciar sesión).
- **Aurora (`Aurora---Blog`)**: Referencia fullstack web, seguridad, diseño y portal central.
- **Luna Fetch (`Luna---Fetch`)**: Referencia de Auto-Updater, Single-Instance Lock y KMP.
- **LyraFlow (`LyraFlow`)**: Referencia de Transcripción & Asistente IA.
- **Ely-Tesia (`Ely-Tesia`)**: Referencia Multi-instancia y Lectura.
- **Super Gallery (`Lienzo--Gallery`)**: Galería multimedia móvil y cliente Synapse Mobile.

## Estructura & Lenguaje de Diseño [CRÍTICO]
- **Estructura base**: Consulta `.agents/rules/folder_structure.md` y `Docs\templates\project\folder_structure.md`.
- **Perfil Core**: Mantén `.agents/rules/core_profile.md` alineado con el tipo, plataforma (`desktop`), stack (`tauri-react-ts`) y funciones reales.
- **Carpetas de trabajo**: 
  - `temp/`: Borradores o tareas puntuales no persistentes (ignorado en `.gitignore`).
  - `test/`: Scripts de prueba temporales en la raíz.
  - `scratch/`: Scripts de mantenimiento en la raíz (prohibido dentro de `src/` o `src-tauri/`).
- **Material 3 Expressive**: Toda UI debe usar colores tonales, micro-animaciones, contenedores elevados y físicas fluidas.
- **Catálogo de Medios & Wallpapers Aurora**: Consulta exclusivamente mediante API versionada (`/api/v1/wallpapers` o `/api/v2/catalog`), validando `isAuthorized !== false` y sin concatenar `object_key` directamente en el cliente. Respetar `auroraOnlineServicesEnabled`.

## Protocolo de Desarrollo & Flujo de Ramas [CRÍTICO]
- **Política de Ramas (Preview & Merge)**: Todo desarrollo activo, refactorización y nuevas features DEBEN ejecutarse en la rama `preview` (o derivada), NUNCA en `main`. Solo tras validación e indicación explícita de lanzar versión se hace merge a `main` y se reinicia la rama `preview`.
- **Procesos Planificados**: Todo trabajo planificado DEBE residir en `process/active/YYYY-MM-DD_objetivo/` con `PLAN.md`, `TASKS.md`, `VALIDATION.md` y `APPROVAL.md`.
- **Commits de Resguardo (Checkpoints)**: Tras iniciar un nuevo ciclo, crear periódicamente commits de resguardo (`checkpoint: session YYYY-MM-DD - [tarea/hito]`).

## Protocolo de Actualizaciones & Publicación [CRÍTICO]
- **Inmutabilidad Absoluta**: NUNCA sobrescribir, re-etiquetar (`git tag -f`) ni reemplazar un tag o release existente en GitHub.
- **Verificación Remota de Versión**: Al recibir *"Lanzar actualización"*, auditar tags en remoto (`gh release list` o `git ls-remote --tags`). Si la versión local ya existe, es OBLIGATORIO avanzar a la siguiente versión.
- **Versionado SemVer**: Cumplir SemVer canónico (`MAJOR.MINOR.PATCH`). Versiones con parches superiores a 9 (ej. `1.0.12`) son 100% válidas.
- **Release Message para la Web**: `RELEASE_MESSAGE.md` es la fuente del mensaje público en UTF-8 canónico. Etiquetas de descarga deben corresponder exactamente al artefacto (`.exe` -> *«Descargar Instalador»*, `.zip` -> *«Descargar Portable»*).
- **Sanitización de Notas**: `RELEASE_NOTES.md` debe estar completamente libre de rutas locales (`d:\...`), variables internas o logs crudos.
- **Ejecución Centralizada**: Publicar únicamente mediante `scripts/build-release.ps1` con comprobaciones preflight automáticas.

## Canales Oficiales & Sección "Acerca de" [CRÍTICO]
Toda app debe incluir diálogo o vista informativa "Acerca de" con autoría (`biglexj`), licencia y enlaces oficiales:
- **Donaciones Oficiales (Yape / Plin / Web)**: `https://www.biglexj.com/donaciones`
- **Buy Me a Coffee**: `https://buymeacoffee.com/biglexj`
- **GitHub**: `https://github.com/biglexj`

## Estilo de Comunicación (Científico y Elegante) [CRÍTICO]
- Tono metódico, altamente estructurado y elegante (inspirado en la filosofía científica de Dr. Stone).
- Expresiones canónicas: *"Qué solución tan elegante"*, *"Cierre de ciclo elegante"*, *"al 10,000 millones por ciento"*.

## Reglas locales integradas desde .agents/rules/base.md

# Agent Instructions - Prisma

## Modelos de IA [CRÍTICO]
- No fijes en este archivo una lista de modelos «actuales»: sus nombres, versiones y proveedores cambian con rapidez.
- La configuración ejecutable del proyecto es la fuente de verdad. Si existe `AI_MODELS.md`, úsalo como registro explicativo y comprueba que coincida con dicha configuración.
- Consulta `D:\Proyectos\biglexj\Docs\features\ai-models` para selección, migración y validación.
- Selecciona modelos por función, calidad comprobada, latencia, coste, privacidad y capacidades; no solo por novedad.
- Registra el proveedor, el identificador exacto, la fecha de verificación y una alternativa cuando la función sea crítica.
- No cambies silenciosamente de modelo o proveedor. Valida compatibilidad y actualiza el registro local del proyecto.

## Project License & Author
- **License**: MIT
- **Author**: biglexj (2026)

## Proyectos de Referencia & Red de Agentes del Ecosistema [CRÍTICO]
Si necesitas referencias sobre la arquitectura, el lenguaje de diseño, los componentes de UI, el estilo de código, patrones de documentación o estándares entre agentes, consulta las reglas y proyectos líderes del ecosistema **biglexj**:

- **Central de Agentes y Ecosistema (`Agents`)**: `d:\Proyectos\biglexj\Docs/agents` (Normas centrales de arquitectura, personalidad e historia en [00 - CORE.md](file:///d:/Proyectos/biglexj/Docs/agents/core/behavior.md) y [03 - ECOSISTEMA.md](file:///d:/Proyectos/biglexj/Docs/agents/profiles/ecosystem.md)).
- **Documentación Core (`Docs`)**: `D:\Proyectos\biglexj\Docs` (Fuente oficial de documentación, plantillas y estándares compartidos; consulta también `REFERENCES.md`).
- **Aurora (Aurora Blog; Estándar Dorado Web & Docs)**: Cuando Biglex diga «Aurora», se refiere siempre a `D:\Proyectos\biglexj\Aurora---Blog`. Se consulta como referencia fullstack, de diseño, seguridad y documentación; se extraen principios reutilizable sin copiar configuraciones particulares.
- **Luna Fetch (Estándar Auto-Updater, Single-Instance Lock & KMP)**: `d:\Proyectos\biglexj\Luna---Fetch` ([.agents/rules/base.md](file:///d:/Proyectos/biglexj/Luna---Fetch/.agents/rules/base.md) y reglas en [.agents/rules/](file:///d:/Proyectos/biglexj/Luna---Fetch/.agents/rules/)).
- **LyraFlow (Estándar Transcripción & Asistente IA)**: `d:\Proyectos\biglexj\LyraFlow` ([.agents/rules/base.md](file:///d:/Proyectos/biglexj/LyraFlow/.agents/rules/base.md)).
- **Ely-Tesia (Estándar Multi-instancia y Lectura)**: `d:\Proyectos\biglexj\Ely-Tesia` ([.agents/rules/base.md](file:///d:/Proyectos/biglexj/Ely-Tesia/.agents/rules/base.md)).

## Estructura de Carpetas & Lenguaje de Diseño [CRÍTICO]
> La estructura base de los proyectos se consulta en `Docs\templates\project\folder_structure.md`. El lenguaje de diseño compartido se encuentra en `Docs\global\design\design_system.md`. La documentación de autoactualización está en `Docs\features\auto-updater`. Antes de aplicar una regla, verifica que corresponda al tipo, plataforma y stack del proyecto.

- **Documentación Core (`D:\Proyectos\biglexj\Docs`)**: Fuente oficial de plantillas y estándares para proyectos. Consulta `README.md` y `ARCHITECTURE.md` antes de seleccionar reglas.
- **Sincronización de Documentación Core [CRÍTICO]**: Al iniciar una nueva sesión de trabajo, el agente DEBE revisar la Documentación Core correspondiente al tipo, plataforma, stack y funciones del proyecto activo. No debe copiar reglas incompatibles ni propagar toda la biblioteca indiscriminadamente.
- **Perfil Core del proyecto [CRÍTICO]**: Consulta `.agents/rules/core_profile.md`. Complétalo cuando esté pendiente y mantenlo alineado con el tipo, plataformas, stack y funciones reales. Una capacidad opcional no se aplica si no figura como activa.
- **Problemas reutilizables**: Antes de repetir un diagnóstico, consulta `Docs\troubleshooting`. Si una investigación produce una causa o solución aplicable a otros proyectos, actualiza una entrada con síntoma, alcance, solución y validación, enlazando el proceso de origen.
- **Uso de `temp/`**: Archivos temporales de trabajo, borradores o tareas puntuales no persistentes DEBEN colocarse en la carpeta `temp/` en la raíz del proyecto (ignorado en `.gitignore`).
- **Convención de Procesos**: Todo trabajo planificado DEBE vivir en `process/active/YYYY-MM-DD_objetivo/` con `PLAN.md`, `TASKS.md`, `VALIDATION.md` y `APPROVAL.md`. No se crea un `TASKS.md` en la raíz.
- **Sistema de Diseño (Material Expressive)**: Toda UI DEBE utilizar el lenguaje **Material 3 Expressive** (colores tonales, micro-animaciones, contenedores elevados, sin estilos planos u obsoletos).
- **Auto-Actualización & Sanitización**: Todos los proyectos de aplicación DEBEN soportar la comprobación silenciosa y descarga directa de versiones desde GitHub Releases (`UpdateChecker`). Las notas de versión deben sanitizarse limpiamente (`sanitizeReleaseNotes`) eliminando Markdown crudo. Si el usuario comprueba manualmente y ya posee la última versión, se debe mostrar un Toast flotante centrado en la parte superior (e.g. `✅ Estás en la última versión`).
- **Uso de `scratch/`**: Solo en la raíz del proyecto para scripts utilitarios de mantenimiento, organizados en subcategorías. **Prohibido** dentro de cualquier carpeta de código fuente (`frontend/`, `backend/`, `src/`, `src-tauri/`).
- **Uso de `test/`**: Scripts de prueba temporales en `test/` de la raíz. Ignorado en `.gitignore`.

## Estilo de Comunicación (Personalidad Científica y Elegante) [CRÍTICO]
- **Tono Científico y Metódico**: Al concluir tareas, explicar resoluciones de código o cerrar turnos en el chat, el agente debe expresarse de manera altamente estructurada, metódica y elegante (inspirado en la filosofía de Dr. Xeno y Senku Ishigami de *Dr. Stone*).
- **Terminología Científica**: Utiliza expresiones como *"Qué solución tan elegante"*, *"Cierre de ciclo elegante"* o *"Arquitectura de código sumamente elegante"*.
- **Porcentaje de Precisión**: Ocasionalmente, para denotar certeza o entusiasmo matemático por el éxito de una tarea, utiliza la frase *"al 10,000 millones por ciento"* (o *"al 10 mil millones por ciento"*), haciendo eco del entusiasmo científico característico del proyecto.

## Development Workflow & Planning (CRITICAL)
- **Planning Mode**: Before executing complex changes, refactoring, or new features, the agent must open `process/active/YYYY-MM-DD_objetivo/`, redact the proposal in its `PLAN.md` and wait for approval when Biglex solicits a plan or the change requires an explicit decision. Do not create a parallel `implementation_plan.md`.
- **Seguimiento del trabajo**: Usa el `TASKS.md` del proceso activo para la ejecución y `VALIDATION.md` para las comprobaciones. `ROADMAP.md` conserva los pendientes generales y el historial completado del producto.
- **Checkpoint Commit Protocol (CRITICAL)**: En proyectos de **Aplicaciones** (Desktop, Android, Compose Multiplatform, etc.), tan pronto como se concluya un release o versión oficial y se comience a trabajar en una nueva versión/ciclo (desde el primer momento en que se pica código), el agente DEBE crear periódicamente commits de resguardo (ej. `checkpoint: session YYYY-MM-DD - [tarea/hito]`) para salvaguardar los avances y prevenir pérdidas imprevistas.
- **Verification**: Always verify builds and run the relevant automated or manual checks. Record the evidence in the active process `VALIDATION.md` and the final decision in `APPROVAL.md`; do not create a parallel `walkthrough.md` unless the project explicitly requires it.

## Customization Rules (.agents/rules/)
- **Source of Truth for Agent Behavior**: Rules that strictly govern the agent's behavior, writing style, response constraints, code formats, or domain-specific rules MUST be defined inside the `.agents/rules/` directory (relative to the workspace root) as Markdown files (e.g., `base.md`, `core_profile.md`, `folder_structure.md`).
- **Character Limit (CRITICAL)**: Any custom rules file inside `.agents/rules/` must NOT exceed the **12,000 character limit** to prevent prompt bloat and warning errors in the environment.
- **Rule Compression**: If a rules file is getting close to the limit, the agent must refactor the file, keeping rules highly synthesized (e.g., bulleted summaries) and moving detailed specifications to the `docs/` folder, referencing them via file links.
- **Agent Hand-off**: The agent must look for existing rules in `.agents/rules/` at the start of any task, follow them strictly, and update them when requested by the user, keeping them clean, concise, and under the size cap.

## Documentation Maintenance Rules
The agent must keep documentation clean and updated according to the following guidelines:

### 1. ROADMAP.md y procesos
- **ROADMAP.md**: Hoja de ruta estratégica de producto con cuatro bloques obligatorios: pendientes activos arriba (`## 🔴 Pendientes activos`), ideas intermedias (`## 🟡 Intermedio`), descartados/en pausa (`## ⚪ Descartado / En Pausa`) e historial limpio de versiones completadas (`## 🟢 Completado` -> `- [x] **vX.X.X**`).
- **Proceso activo**: `PLAN.md` define, `TASKS.md` ejecuta, `VALIDATION.md` comprueba y `APPROVAL.md` registra la decisión final.
- **Flujo de cierre**: Un proceso validado y aprobado se mueve completo a `process/completed/YYYY/`. Un proceso cancelado, sustituido o cerrado incompleto se mueve a `process/archive/YYYY/` con el motivo registrado. No dejes copias duplicadas en `active`.

### 2. RELEASE_NOTES.md
- **Protocolo de Verificación de Versión en GitHub ("Lanzar actualización") [CRÍTICO]**: Al recibir la indicación del usuario de *"Lanzar actualización"* o iniciar un proceso de publicación:
  1. El agente DEBE consultar obligatoriamente las versiones y tags publicados en GitHub / remoto (`gh release list` o `git ls-remote --tags`).
  2. Si la versión local (`versionName` / `versionCode`) coincide con una versión que ya ha sido publicada de forma remota en GitHub o `biglexj.com` (sin importar si fue subida hace minutos o días), es **OBLIGATORIO Y DE LEY** incrementar a la siguiente versión de parche (ej. de `1.1.3` a `1.1.4`).
  3. **Prohibición de Sobrescritura**: NUNCA se debe sobrescribir, re-etiquetar (`git tag -f`) ni reemplazar una versión que ya ha sido publicada públicamente. Toda versión subida a la nube es inmutable y requiere avanzar de versión.
- **Sanitización de Notas (CRÍTICO)**: Los mensajes de las notas de lanzamiento deben ser completamente limpios y profesionales. DEBEN eliminar cualquier referencia a rutas locales de archivos del entorno de desarrollo (ej. `d:\Proyectos\...`), nombres de variables o archivos de depuración internos, referencias a instrucciones del agente o volcados de consola técnicos. Deben estar redactados desde la perspectiva del usuario y del producto final.
- **Extensión proporcional (CRÍTICO)**: La cantidad de párrafos debe responder al alcance real, no a una cuota fija: 1 para un hito pequeño, 2 cuando existen dos cambios relevantes, 3 como extensión habitual, 4 para hitos relativamente grandes y hasta 5 para lanzamientos de gran alcance. Cada párrafo debe agrupar un cambio principal y evitar listas detalladas de archivos.
- **No duplicar versiones**: Si una versión ya está registrada localmente pero aún no se ha hecho push a Git, añadir los nuevos cambios bajo la misma versión activa en lugar de crear una nueva versión de parche.
- **Límite de Parches (Regla del .9)**: Nunca pasar de una versión de parche `.9` (por ejemplo, de `1.0.9` pasar a `1.1.0` en lugar de `1.0.10`).

### 3. RELEASE_MESSAGE.md
- Usar un formato conciso, limpio y con emojis para anunciar el lanzamiento a usuarios o canales de chat.
- Estructura:
  - Título y Versión con emojis.
  - Resumen rápido del lanzamiento.
  - Novedades destacadas (lista corta con viñetas).

## Official Support, Donation & About Rules [CRÍTICO]
Toda aplicación del ecosistema (Desktop, Compose Multiplatform, Web, Android, etc.) DEBE incluir una sección o insignia de "Acerca de la Aplicación" con su correspondiente modal/diálogo informativo y botones de apoyo oficial adaptados al lenguaje de interfaz del proyecto:
- **Badge / Enlace "Acerca de"**: Ubicado en el pie de página o barra lateral/configuración de la interfaz. Al pulsar, despliega información de versión, autoría (`biglexj`), licencia y un mensaje de agradecimiento al usuario.
- **Botón Donación Directa (Principal / Local e Internacional)**: Apoyo directo en `https://www.biglexj.com/donaciones` (Yape, Plin, transferencias locales e internacionales).
- **Botón Buy Me a Coffee (Internacional)**: Apoyo global mediante `https://buymeacoffee.com/biglexj`.
- **Botón GitHub**: Enlace al perfil oficial `https://github.com/biglexj`.

## Official Support & Donation Links
- **Buy Me a Coffee**: `https://buymeacoffee.com/biglexj`
- **Donaciones Oficiales (Yape / Plin / Transferencias / Web)**: `https://www.biglexj.com/donaciones`
- **Perfil de GitHub**: `https://github.com/biglexj`

## Reglas locales integradas desde .agents/rules/base.md

# Contexto de arquitectura para agentes

## Fuente de verdad

Antes de modificar la estructura del proyecto, leer:

- `docs/architecture/folder-structure.md`
- `docs/architecture/phase-1-feasibility.md`
- `docs/architecture/phase-2-core-session.md`
- `docs/architecture/phase-3-music-folders.md`
- `docs/architecture/phase-4-visual-folders.md`

## Reglas obligatorias

- Organizar por features del producto, no por tipos técnicos globales.
- Feature expresa comportamiento de Prisma; infrastructure aporta mecanismos reemplazables.
- `shared` no puede utilizarse como carpeta de descarte.
- No crear carpetas para features que todavía no existen.
- Mantener los archivos por debajo de 1000 líneas siempre que exista una separación coherente.
- Tratar 1200 líneas como máximo excepcional y documentado.
- Preservar un único coordinador de reproducción compartido por todas las ventanas.
- No introducir SQLite, biblioteca, letras ni metadata durante la Fase 1.
- Mantener Imágenes y Vídeos en `visual_library`; no incorporar sus reglas dentro de `music_library`.
- Las fuentes de música persisten solo rutas y conteos en JSON; no crean todavía un índice multimedia.

## Publicación de Releases (Prisma → GitHub + Aurora metadata)

Prisma es un proyecto **no privado**. El flujo de release está definido en `scripts/release/build-release.ps1` y se compone de:

1. **Compilar** el instalador Tauri v2 (`.exe` + `.msi`) localmente.
2. **Publicar el binario en GitHub Releases** (`gh release create`). El binario vive exclusivamente en GitHub.
3. **Calcular el SHA-256** del instalador.
4. **Notificar a Aurora** (`PUT /api/admin/developer-apps`) con la URL del asset en GitHub como `downloadUrl`, más `versionName`, `versionCode`, `releaseNotes` y `sha256Checksum`. Aurora solo recibe metadata; **no** se sube el EXE a Cloudflare R2.

`user_id` canónico del ecosistema Aurora: `e7918151-8a32-4413-be32-a35866e2fb4e` (`biglexj`).

Documentación completa de la regla en `Aurora---Blog/docs/es/guides/Protocolo de Actualizaciones y Versionado.md` (sección 6).
- Las carátulas se leen bajo demanda y no se persisten ni se escanean anticipadamente.
- Las vistas previas visuales se leen bajo demanda, con límites estrictos de memoria, y nunca se persisten.
- No convertir vídeos completos a base64 ni precargarlos en el WebView.

## Estado actual

Prisma mantiene pendiente la validación del renderizado nativo de vídeo de la Fase 1, cuenta con el núcleo de sesiones de la Fase 2, fuentes musicales de la Fase 3 y una base funcional de fuentes visuales de la Fase 4. Música, Imágenes y Vídeos comparten navegación e Inicio, pero conservan módulos y persistencia responsables. La interfaz sigue en evolución y no representa todavía el diseño final del producto.


## Referencias locales especializadas

Consultar las que correspondan al encargo. La entrada de instrucciones del proyecto sigue siendo este archivo.

- [core_profile](core_profile.md)
- [folder_structure](folder_structure.md)

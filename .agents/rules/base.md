---
trigger: always_on
---

# Agent Instructions - Prisma

## Modelos de IA [CRÍTICO]
- No fijes en este archivo una lista de modelos «actuales»: sus nombres, versiones y proveedores cambian con rapidez.
- La configuración ejecutable del proyecto es la fuente de verdad. Si existe `AI_MODELS.md`, úsalo como registro explicativo y comprueba que coincida con dicha configuración.
- Consulta `D:\Proyectos\biglexj\Core-Docs\features\ai-models` para selección, migración y validación.
- Selecciona modelos por función, calidad comprobada, latencia, coste, privacidad y capacidades; no solo por novedad.
- Registra el proveedor, el identificador exacto, la fecha de verificación y una alternativa cuando la función sea crítica.
- No cambies silenciosamente de modelo o proveedor. Valida compatibilidad y actualiza el registro local del proyecto.

## Project License & Author
- **License**: MIT
- **Author**: biglexj (2026)

## Proyectos de Referencia & Red de Agentes del Ecosistema [CRÍTICO]
Si necesitas referencias sobre la arquitectura, el lenguaje de diseño, los componentes de UI, el estilo de código, patrones de documentación o estándares entre agentes, consulta las reglas y proyectos líderes del ecosistema **biglexj**:

- **Central de Agentes y Ecosistema (`Agents`)**: `d:\Proyectos\biglexj\Agents` (Normas centrales de arquitectura, personalidad e historia en [00 - CORE.md](file:///d:/Proyectos/biglexj/Agents/Core/00%20-%20CORE.md) y [03 - ECOSISTEMA.md](file:///d:/Proyectos/biglexj/Agents/Core/03%20-%20ECOSISTEMA.md)).
- **Documentación Core (`Core-Docs`)**: `D:\Proyectos\biglexj\Core-Docs` (Fuente oficial de documentación, plantillas y estándares compartidos; consulta también `REFERENCES.md`).
- **Aurora (Aurora Blog; Estándar Dorado Web & Docs)**: Cuando Biglex diga «Aurora», se refiere siempre a `D:\Proyectos\biglexj\Aurora---Blog`. Se consulta como referencia fullstack, de diseño, seguridad y documentación; se extraen principios reutilizable sin copiar configuraciones particulares.
- **Luna Fetch (Estándar Auto-Updater, Single-Instance Lock & KMP)**: `d:\Proyectos\biglexj\Luna---Fetch` ([agent.md](file:///d:/Proyectos/biglexj/Luna---Fetch/agent.md) y reglas en [.agents/rules/](file:///d:/Proyectos/biglexj/Luna---Fetch/.agents/rules/)).
- **LyraFlow (Estándar Transcripción & Asistente IA)**: `d:\Proyectos\biglexj\LyraFlow` ([agent.md](file:///d:/Proyectos/biglexj/LyraFlow/agent.md)).
- **Ely-Tesia (Estándar Multi-instancia y Lectura)**: `d:\Proyectos\biglexj\Ely-Tesia` ([agent.md](file:///d:/Proyectos/biglexj/Ely-Tesia/agent.md)).

## Estructura de Carpetas & Lenguaje de Diseño [CRÍTICO]
> La estructura base de los proyectos se consulta en `Core-Docs\templates\project\folder_structure.md`. El lenguaje de diseño compartido se encuentra en `Core-Docs\global\design\design_system.md`. La documentación de autoactualización está en `Core-Docs\features\auto-updater`. Antes de aplicar una regla, verifica que corresponda al tipo, plataforma y stack del proyecto.

- **Documentación Core (`D:\Proyectos\biglexj\Core-Docs`)**: Fuente oficial de plantillas y estándares para proyectos. Consulta `README.md` y `ARCHITECTURE.md` antes de seleccionar reglas.
- **Sincronización de Documentación Core [CRÍTICO]**: Al iniciar una nueva sesión de trabajo, el agente DEBE revisar la Documentación Core correspondiente al tipo, plataforma, stack y funciones del proyecto activo. No debe copiar reglas incompatibles ni propagar toda la biblioteca indiscriminadamente.
- **Perfil Core del proyecto [CRÍTICO]**: Consulta `.agents/rules/core_profile.md`. Complétalo cuando esté pendiente y mantenlo alineado con el tipo, plataformas, stack y funciones reales. Una capacidad opcional no se aplica si no figura como activa.
- **Problemas reutilizables**: Antes de repetir un diagnóstico, consulta `Core-Docs\troubleshooting`. Si una investigación produce una causa o solución aplicable a otros proyectos, actualiza una entrada con síntoma, alcance, solución y validación, enlazando el proceso de origen.
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

# Agent Instructions - Prisma

## Modelos de IA [CRÍTICO]
- La configuración ejecutable del proyecto es la fuente de verdad (`AI_MODELS.md` como registro explicativo si existe).
- Consulta `D:\Proyectos\biglexj\Core-Docs\features\ai-models` para selección, migración y validación.
- Selecciona modelos por función, calidad comprobada, latencia, coste, privacidad y capacidades.
- No cambies silenciosamente de modelo o proveedor; valida compatibilidad y actualiza el registro local.

## Project License & Author
- **License**: MIT
- **Author**: biglexj (2026)

## Red de Agentes & Proyectos de Referencia [CRÍTICO]
- **Central del Ecosistema (`Agents`)**: `d:\Proyectos\biglexj\Agents` ([00 - CORE.md](file:///d:/Proyectos/biglexj/Agents/Core/00%20-%20CORE.md), [03 - ECOSISTEMA.md](file:///d:/Proyectos/biglexj/Agents/Core/03%20-%20ECOSISTEMA.md)).
- **Documentación Core (`Core-Docs`)**: `D:\Proyectos\biglexj\Core-Docs` (Fuente oficial de estándares y plantillas; revisar siempre al iniciar sesión).
- **Aurora (`Aurora---Blog`)**: Referencia fullstack web, seguridad, diseño y portal central.
- **Luna Fetch (`Luna---Fetch`)**: Referencia de Auto-Updater, Single-Instance Lock y KMP.
- **LyraFlow (`LyraFlow`)**: Referencia de Transcripción & Asistente IA.
- **Ely-Tesia (`Ely-Tesia`)**: Referencia Multi-instancia y Lectura.
- **Super Gallery (`Lienzo--Gallery`)**: Galería multimedia móvil y cliente Synapse Mobile.

## Estructura & Lenguaje de Diseño [CRÍTICO]
- **Estructura base**: Consulta `.agents/rules/folder_structure.md` y `Core-Docs\templates\project\folder_structure.md`.
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

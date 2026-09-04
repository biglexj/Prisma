---
trigger: always_on
---

# 📁 Regla de Estructura de Carpetas — Prisma

> [!CAUTION]
> Esta regla es **CRÍTICA y no negociable**. Todo nuevo archivo, carpeta o módulo creado por el agente DEBE seguir esta convención. Violar esta estructura es inaceptable y debe ser corregido inmediatamente.

## Estructura Raíz del Proyecto (Desktop — React + TypeScript + Tauri + Rust)

```
Prisma/                             # Raíz del repositorio
├── .agents/rules/                  # Reglas del agente (base.md, folder_structure.md, core_profile.md)
├── docs/                           # Documentación técnica y guías del proyecto
├── icon/                           # Icono fuente de la aplicación (icon.png)
├── process/                        # Planificación, tareas, validación y aprobación
│   ├── active/                     # Procesos actualmente en ejecución
│   ├── completed/                  # Procesos validados y aprobados, por año
│   ├── archive/                    # Procesos cancelados o cerrados incompletos
│   └── templates/                  # Moldes locales para crear procesos
├── public/                         # Recursos estáticos del frontend
├── scripts/                        # Scripts utilitarios y de release (release/build-release.ps1, free-port.ts)
├── src/                            # Frontend (React 19 + TypeScript)
│   ├── app/                        # Layout principal, providers y comandos frontend
│   ├── features/                   # Lógica de negocio organizada por dominios (camelCase)
│   │   ├── home/                   # Vista principal y resumen de biblioteca
│   │   ├── music_library/          # Explorador, pistas y colecciones de música
│   │   ├── playback/               # Controles de reproducción audio/video (MPV/Web)
│   │   └── visual_library/         # Galería de imágenes, videos y miniaturas
│   ├── shared/                     # Componentes y utilidades transversales (usados por 2+ features)
│   │   └── components/             # Átomos UI compartidos
│   ├── main.tsx                    # Punto de entrada de React
│   └── vite-env.d.ts
├── src-tauri/                      # Backend nativo (Rust + Tauri v2)
│   ├── capabilities/               # Permisos y capacidades de ventanas y plugins
│   ├── gen/                        # Recursos y esquemas generados por Tauri
│   ├── icons/                      # Iconos compilados para la aplicación de escritorio
│   ├── src/                        # Código Rust modular (app/commands, domain, infrastructure)
│   │   ├── app/                    # Handlers de comandos Tauri expuestos a JS
│   │   ├── domain/                 # Entidades y tipos de dominio puro
│   │   ├── infrastructure/         # Repositorios de datos, miniaturas y vista previa media
│   │   ├── lib.rs                  # Entrada de librería y registro de comandos
│   │   └── main.rs                 # Punto de entrada del ejecutable Rust
│   ├── build.rs                    # Script de compilación de Rust
│   ├── Cargo.toml                  # Manifiesto de dependencias y características de Rust (mpv)
│   └── tauri.conf.json             # Configuración oficial del bundle Tauri (ventanas, títulos, iconos)
├── scratch/                        # Scripts utilitarios de mantenimiento (solo raíz)
├── temp/                           # Archivos temporales de trabajo (ignorado en .gitignore)
├── test/                           # Scripts de prueba temporales (ignorado en .gitignore)
├── .agents/rules/base.md                        # Instrucciones principales del agente (raíz)
├── LICENSE                         # Licencia MIT
├── NOTICE.md                       # Avisos legales y atribuciones
├── README.md                       # Documentación pública del proyecto
├── RELEASE_MESSAGE.md              # Mensaje de anuncio del último lanzamiento
├── RELEASE_NOTES.md                # Historial de cambios por versión (sanitizado)
├── ROADMAP.md                      # Pendientes, prioridades e historial del producto
├── package.json                    # Dependencias y scripts de Bun/NPM
├── tsconfig.json                   # Configuración TypeScript
└── vite.config.ts                  # Configuración del empaquetador Vite
```

## Reglas de Nomenclatura [CRÍTICO]

| Elemento | Convención | Ejemplo |
|---|---|---|
| Carpetas de feature (JS/TS) | `snake_case` o `camelCase` | `music_library/`, `visual_library/` |
| Componentes React | `PascalCase` + `.tsx` | `MusicPlayer.tsx`, `VideoThumbnail.tsx` |
| Módulos / Archivos Rust | `snake_case` + `.rs` | `media_preview.rs`, `visual_library.rs` |
| Comandos Tauri (Rust) | `snake_case` | `get_visual_items`, `play_media` |
| Tipos y Data Classes | `PascalCase` | `MediaItem`, `PlaybackState` |
| Constantes | `SCREAMING_SNAKE_CASE` | `MAX_THUMBNAIL_WIDTH` |

## Reglas Estructurales Obligatorias

### ✅ PERMITIDO
- Crear sub-componentes dentro de la carpeta de su feature en `src/features/[feature]/`.
- Crear componentes en `src/shared/components/` solo si son usados por **2 o más** features distintas.
- Usar `test/` en la raíz para scripts temporales de prueba.
- Usar `scratch/` en la raíz para scripts de mantenimiento, organizados en subcategorías.
- Usar `temp/` en la raíz para archivos temporales de sesión.

### ❌ PROHIBIDO — VIOLACIONES COMUNES A EVITAR
- **Nunca** crear carpetas `scratch/` dentro de `src/`, `src-tauri/` o subcarpetas de código fuente.
- **Nunca** colocar archivos de lógica de negocio directamente en la raíz de `src/` sin una carpeta de feature.
- **Nunca** duplicar componentes: si ya existe en `shared/`, importarlo; no copiarlo.
- **Nunca** añadir archivos de modelo/tipo directamente dentro de carpetas de UI sin contexto semántico.
- **Nunca** crear carpetas con nombres genéricos (`utils/`, `helpers/`, `misc/`) en la raíz del proyecto sin categoría clara.
- **Nunca** dejar archivos de código sueltos sin pertenecer a una carpeta semántica.

## Regla de Crecimiento de Archivos

Como buena práctica, se debe **evitar normalmente que un archivo supere las 800 - 900 líneas**. El límite máximo permitido es de **1000 a 1200 líneas** (pudiendo llegar excepcionalmente hasta **1220 líneas**). Los archivos que superen las **1200 - 1220 líneas** son **deuda técnica activa** y el agente DEBE proponer su división en sub-componentes y registrarlo en el ROADMAP como tarea de refactorización pendiente.

- **Límite Preferido**: Evitar exceder de 800 a 900 líneas por archivo.
- **Límite Máximo Absoluto**: 1000 a 1200 líneas (máximo 1220 líneas excepcionales).
- **Componentes y Screens**: Si un archivo supera las 1200 líneas, extraer sub-componentes en su carpeta de feature.

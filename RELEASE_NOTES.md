# 🌌 Release Notes - Prisma

> [!IMPORTANT]
> **Protocolo de Verificación de Versión en GitHub ("Lanzar actualización") [CRÍTICO]:**
> - Al recibir la orden de *"Lanzar actualización"*, es **OBLIGATORIO Y DE LEY** consultar primero la última versión publicada en GitHub / remoto (`gh release list` o `git ls-remote --tags`).
> - Si la versión local ya fue subida (así haya sido lanzada hace minutos), NUNCA se debe sobrescribir ni re-etiquetar. Se DEBE incrementar obligatoriamente a la siguiente versión de parche (e.g. `0.6.0` → `0.6.1`).
>
> **Sanitización de Notas (CRÍTICO):**
> - Los mensajes de las notas de lanzamiento DEBEN estar limpios de rutas de archivos del sistema local (ej. `d:\Proyectos\...`), nombres de variables internas, fragmentos de prompts o logs técnicos de depuración. Deben redactarse con lenguaje limpio, profesional y enfocado al usuario final.
>
> **Regla del .9 para Versionado:**
> - Nunca se debe pasar de una versión de parche `.9` (ej. de `0.6.9` no se pasa a `0.6.10`). Al alcanzar el límite del parche `.9`, se incrementa el número menor/secundario (ej. pasando a `0.7.0`).
> - **Extensión proporcional en Release Notes:** La cantidad de párrafos depende del alcance: 1 para un hito pequeño, 2 cuando hay dos cambios relevantes, 3 como extensión habitual, 4 para hitos relativamente grandes y hasta 5 para lanzamientos de gran alcance. Cada párrafo debe concentrarse en un cambio principal y evitar descripciones excesivamente largas o listas detalladas de archivos.

Registro histórico de cambios y versiones de Prisma.

## [0.6.0] - 2026-08-11

### Resumen
Inclusión del modo de velocidad rápida 2x por pulsación prolongada en vídeo, vista animada de letras en vivo sincronizada línea por línea e integración completa de la arquitectura y gobernanza del ecosistema **biglexj**.

### Detalles
- **Aceleración 2x en Vídeo por Mantención**: Mantener presionado en la superficie del reproductor de vídeo o en el botón de velocidad activa de inmediato el modo a 2.0x con un indicador flotante animado de velocidad.
- **Letras Animadas Sincronizadas**: Nueva pestaña de navegación de "Letras" en el reproductor con desplazamiento suave línea a línea, animaciones Material 3 Expressive para la frase activa y resaltado luminoso con pulso.
- **Estandarización Ecosistema biglexj**: Configuración completa de reglas en `.agents/rules/` (`base.md`, `core_profile.md`, `folder_structure.md`) e instrucciones sincronizadas en `agent.md`.
- **Estructura de Procesos `process/`**: Moldes y carpeta de proceso activo `2026-08-11_estandarizacion_ecosistema_biglexj/` para gobernanza de cambios.

---

## [0.5.0] - 2026-08-10

### Resumen
Optimización del motor de vista previa multimedia y aceleración de renderizado de miniaturas visuales.

### Detalles
- Integración avanzada de decodificación mediante motor nativo MPV.
- Mejora en la generación asíncrona de miniaturas para colecciones de fotos y videos.

---

## [0.4.0] - 2026-08-08

### Resumen
Consolidación del módulo de biblioteca de música y gestión de reproducción local.

### Detalles
- Soporte para lectura de metadatos de audio (etiquetas Lofty/ID3) y portadas de álbum.
- Sistema de cola de reproducción e interfaz de control de audio en segundo plano.

---

## [0.3.0] - 2026-08-05

### Resumen
Diseño de interfaz de usuario bajo el sistema de diseño **Material 3 Expressive**.

### Detalles
- Incorporación de contenedores elevados, paletas tonales personalizadas y micro-animaciones en navegación.
- Implementación del panel Dashboard principal para exploración rápida de contenido multimedia.

---

## [0.2.0] - 2026-08-01

### Resumen
Integración nativa Rust-Tauri v2 y comunicación eficiente mediante comandos IPC.

### Detalles
- Configuración de puente IPC entre React/TypeScript y la capa de infraestructura Rust.
- Escaneo y sincronización de directorios locales con persistencia eficiente.

---

## [0.1.0] - 2026-07-25

### Resumen
Lanzamiento inicial de la arquitectura base del proyecto Prisma como visor y reproductor multimedia local-first.

### Detalles
- Configuración inicial de Vite, React 19, TypeScript y Tauri 2.
- Definición de la estructura de paquetes y manifesto inicial.

# 🌌 Release Notes - Prisma

> [!IMPORTANT]
> **Protocolo de Verificación de Versión en GitHub ("Lanzar actualización") [CRÍTICO]:**
> - Al recibir la orden de *"Lanzar actualización"*, es **OBLIGATORIO Y DE LEY** consultar primero la última versión publicada en GitHub / remoto (`gh release list` o `git ls-remote --tags`).
> - Si la versión local ya fue subida (así haya sido lanzada hace minutos), NUNCA se debe sobrescribir ni re-etiquetar. Se DEBE incrementar obligatoriamente a la siguiente versión de parche (e.g. `0.0.1` → `0.0.2`).
>
> **Sanitización de Notas (CRÍTICO):**
> - Los mensajes de las notas de lanzamiento DEBEN estar limpios de rutas de archivos del sistema local (ej. `d:\Proyectos\...`), nombres de variables internas, fragmentos de prompts o logs técnicos de depuración. Deben redactarse con lenguaje limpio, profesional y enfocado al usuario final.
>
> **Regla del .9 para Versionado:**
> - Nunca se debe pasar de una versión de parche `.9` (ej. de `0.0.9` no se pasa a `0.0.10`). Al alcanzar el límite del parche `.9`, se incrementa el número menor/secundario (ej. pasando a `0.1.0`).
> - **Extensión proporcional en Release Notes:** La cantidad de párrafos depende del alcance: 1 para un hito pequeño, 2 cuando hay dos cambios relevantes, 3 como extensión habitual, 4 para hitos relativamente grandes y hasta 5 para lanzamientos de gran alcance. Cada párrafo debe concentrarse en un cambio principal y evitar descripciones excesivamente largas o listas detalladas de archivos.

Registro histórico de cambios y versiones de Prisma.

## [1.0.1] - 2026-08-17

### Resumen
Actualización **Prisma v1.0.1** orientada a la integración del nuevo **Convertidor Prisma** por lotes con soporte de carpetas completas y menús contextuales, agrupación inteligente de música por metadatos de álbum con vista de detalle dedicada, y perfeccionamiento de alta precisión en **Prisma Quick Look** para Windows 11 con pestañas.

### Detalles
- **Convertidor Prisma e Integración Contextual**: Módulo de conversión por lotes para imágenes con soporte de procesamiento de archivos sueltos o carpetas completas, ajustes de redimensión proporcional, calidad y formatos (JPG, PNG, WebP, AVIF, BMP, TIFF, GIF...). Incluye acción directa desde el menú contextual con clic derecho en carpetas y álbumes para convertir al instante.
- **Música Inteligente por Álbum y Vista Detallada**: Agrupación automática basada en etiquetas ID3 de álbum con fallback ordenado por carpetas. Nueva vista detallada de álbum con lista de pistas, duración total, carátula y doble interacción en tarjetas (clic para explorar canciones, botón central para reproducción directa), además de estabilización en el editor de metadatos.
- **Prisma Quick Look Perfeccionado para Windows 11**: Detección jerárquica de la pestaña activa en el Explorador de Windows 11 mediante seguimiento de foco e inspección de ventanas en primer plano, eliminando parpadeos y asegurando la previsualización del archivo exacto. Incorpora auto-cierre inmediato de la ventana flotante al abrir archivos con la aplicación predeterminada del sistema.
- **Densidad de Interfaz y Ajustes**: Nuevo selector de densidad de altura en configuración con opción intermedia equilibrada a 42px y adaptación responsiva de componentes.

## [1.0.0] - 2026-08-16

### Resumen
Lanzamiento inaugural de **Prisma v1.0.0**, la estación multimedia local-first diseñada bajo el lenguaje Material 3 Expressive para Windows. Combina reproducción de audio de alta fidelidad, visor cinematográfico de imágenes con editor integrado, reproductor de vídeo con PiP, Quick Look universal para todo tipo de archivos, **Bibliotecas Modulares Personalizables** con lector y editor in-app, y control remoto LAN mediante Aurora Synapse.

### Detalles
- **Bibliotecas Modulares y Lector/Editor Integrado**: Creación y gestión de colecciones personalizadas (Libros/PDFs, Documentos Markdown, Código Fuente, Proyectos Gráficos como Krita `.kra` y Photoshop `.psd`) con modo dividido (*Split View*), edición en tiempo real, atajos (`Ctrl+S`), control tipográfico (*Sans*, *Serif*, *Mono*) y zoom fluido de 11px a 32px.
- **Explorador y Biblioteca Universal**: Navegación fluida por Línea de Tiempo, Álbumes por Carpetas y Árbol Jerárquico para Música, Imágenes y Vídeos con ordenación dinámica por fecha, nombre, tamaño y modo aleatorio.
- **Prisma Quick Look Universal**: Previsualización instantánea con barra espaciadora desde el Explorador de Windows o Escritorio para audio, vídeo, imágenes, documentos PDF, textos planos, código y proyectos de diseño.
- **Reproductor de Vídeo y Modo PiP Adaptativo**: Proyección fluida con selección de pistas de audio y subtítulos, conmutación fluida, avance rápido 3.0x continuo y ventana flotante Picture-in-Picture que respeta la relación de aspecto original.
- **Visor y Editor de Imágenes**: Navegación suave entre fotos con zoom hasta 500%, filtros tonales, recorte interactivo, guardado seguro y aislamiento estricto de carpetas excluidas.
- **Sincronización y Mando Remoto LAN**: Control de reproducción, volumen, pistas y navegación a distancia desde dispositivos de la red local mediante el protocolo Aurora Synapse.
- **Listas de Reproducción y Gestión de Archivos**: Soporte universal de listas en formatos M3U, M3U8, PLS y XSPF con reconexión inteligente, historial consolidado y gestión de favoritos.

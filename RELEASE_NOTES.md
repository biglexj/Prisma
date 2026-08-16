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

## [0.0.3] - 2026-08-15

### Resumen
Actualización de estabilidad y pulido visual en la vista previa ligera (Quick Look), garantizando la detención total de la reproducción en segundo plano y el ajuste armónico de todos los controles e iconos de la interfaz.

### Detalles
- **Detención Integral de Reproducción al Cerrar o Desenfocar**: Sincronización estricta del ciclo de vida multimedia para que al cerrar la vista previa ligera (pulsando '✕', haciendo clic fuera de la ventana o cerrando desde la barra de tareas) la pista de audio o vídeo se detenga por completo, sin dejar audio residual ni procesos ocultos en segundo plano.
- **Armonización de Iconos y Controles**: Redimensionamiento proporcional de los iconos de volumen, controles de reproducción y botón de apertura en ventana completa dentro de la vista previa rápida, evitando textos divididos o elementos sobredimensionados.
- **Optimización del Instalador Windows**: Configuración exclusiva para paquetes de instalación NSIS de alto rendimiento, reduciendo el tamaño del bundle y eliminando compilaciones intermedias innecesarias.

## [0.0.2] - 2026-08-15

### Resumen
Actualización de refinamiento orientada a la experiencia de reproducción multimedia continua, gestión de instancia única del sistema y perfeccionamiento visual de la interfaz del reproductor de vídeo e instalador.

### Detalles
- **Instancia Única y Conmutación Inteligente de Medios**: Integración del bloqueo de proceso único para evitar la apertura de ventanas duplicadas, múltiples iconos en la bandeja del sistema y audios superpuestos. Al abrir un nuevo archivo desde el sistema, este reemplaza atómicamente la reproducción activa y enfoca la ventana principal o Quick Look.
- **Perfeccionamiento del Reproductor de Vídeo**: Corrección de superposición de capas en la Cola de Proyección para que quede sobre la barra de controles sin cortes visuales, eliminación de brechas en el diseño del encabezado y ajuste del temporizador de auto-ocultamiento de controles a 3 segundos.
- **Icono Oficial en el Instalador**: Incorporación del icono de alta resolución de Prisma en el paquete de instalación oficial para Windows (NSIS).

## [0.0.1] - 2026-08-15

### Resumen
Primer lanzamiento oficial de **Prisma**, la estación y reproductor multimedia local-first diseñada bajo el lenguaje Material 3 Expressive para Windows. Integra reproducción de audio de alta fidelidad, visor avanzado de imágenes con edición, reproductor de vídeo con PiP nativo, Quick Look global y soporte universal de listas de reproducción.

### Detalles
- **Explorador y Biblioteca Integral**: Navegación por tiempo, carpetas y árbol jerárquico para Música, Imágenes y Vídeos con ordenación dinámica por fecha, nombre, tamaño y modo aleatorio (shuffle).
- **Prisma Quick Look**: Previsualización instantánea de archivos de audio, imagen y vídeo desde el Explorador de Windows o Escritorio pulsando la barra espaciadora.
- **Reproductor de Vídeo Avanzado**: Proyección fluida con selección de pistas de audio y subtítulos, avance rápido 3.0x continuo y modo Picture-in-Picture (PiP) adaptativo respetando la relación de aspecto real.
- **Visor y Editor de Imágenes**: Navegación con fundido suave entre imágenes, zoom fluido hasta 500%, recorte interactivo, filtros tonales y guardado con renombrado seguro.
- **Listas de Reproducción Universales**: Detección, importación y gestión de listas en formatos M3U, M3U8, PLS y XSPF con reconexión inteligente de archivos faltantes.

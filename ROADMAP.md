# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [x] **Arrastre Nativo Universal hacia Apps Externas (Drag & Drop OS: DaVinci, Affinity, Krita, etc.)**: Soporte nativo del sistema operativo para mantener pulsado y arrastrar cualquier archivo (vídeos, fotos, música, documentos PDF, etc.) desde las cuadrículas o visores de Prisma directamente hacia aplicaciones externas como Affinity (Photo, Designer, Publisher), Krita, DaVinci Resolve, Photoshop o el Explorador de Windows mediante OLE `CF_HDROP`.
- [x] **Marca de Agua Visual y Metadatos de Autoría (Individual y por Lotes)**: Estampado paramétrico de marca de agua (logo PNG y texto con fecha/autor, escala, opacidad y anclaje adaptativo a esquinas, bordes o centro, basado en el estándar de Super Galería) en el Editor de Imágenes y en el Convertidor Prisma, junto con inyección de metadatos de derechos y autoría.
- [ ] **Normalización de Volumen y ReplayGain Conmutable en DSP**: Nivelación acústica automática en el pipeline WASAPI con botón de encendido/apagado en el Ecualizador y atajo de teclado dedicado.
- [ ] **Metadatos Técnicos y Marcado de Tomas de Vídeo (Workflow DaVinci)**: Ficha técnica de cámara, códec, fps y perfil de color en el reproductor de vídeo, con marcadores rápidos de toma (*Good Take*, *Descarte*, *B-Roll*, colores de clip) para pre-clasificación de material.

---

## 🟡 Intermedio (Prioridad Media/Baja)

- [ ] **Atajos de teclado configurables**: Personalización interactiva de atajos de teclado desde la vista de Configuración.
---

## ⚪ Descartado / En Pausa

- ⏸️ **Cortador de Audio Básico** — Recorte no-destructivo de segmentos de audio con vista de forma de onda, puntos de entrada/salida y exportación del fragmento. Aplazado: alta complejidad, baja urgencia actual.
- ⏸️ Integración con servicios de streaming en la nube (Prisma se mantiene como visor 100% local-first).
- ⏸️ **Refactorización y Modularización de Galería Visual (`VisualLibrary.tsx`)**: Extracción de sub-componentes de la vista principal (1,230 líneas: filtros, barra de acciones y modales de soporte) para reingresar al umbral preferido (< 900 líneas) estipulado en la arquitectura del proyecto.

---

## 🟢 Completado

- [x] **v1.1.7**
  - **Identidad SMTC Nativa para Vídeo y Miniaturas Reales**:
    - Extensión en Rust de `NativeSmtcManager` con `MediaPlaybackType::Video` y propiedades nativas de vídeo.
    - Extracción de fotogramas de vídeo en JPEG para alimentar la miniatura del flyout multimedia en Windows 10/11.
    - Inactivación de sesiones secundarias y genéricas de WebView2 (`--disable-features=HardwareMediaKeyHandling`).
    - Recepción de controles de transporte físico de hardware (`prisma://smtc-action`) en el reproductor de vídeo.
  - **OSD de Volumen Global Material 3 Expressive**:
    - Indicador flotante superior fijo a nivel de aplicación (`App.tsx`) con acento tonal, micro-animaciones elásticas y memoria de volumen al silenciar.
    - Despliegue unificado al ajustar ganancia con atajos de teclado (`↑` / `↓`, `+` / `-`, `M`), deslizadores de previsualización o mandos remotos.
  - **Transferencias en Segundo Plano a Super Galería (Móvil)**:
    - Envíos por red local desacoplados de la interfaz: capacidad de ocultar el modal con una píldora flotante animada de progreso en tiempo real.
    - Alternancia inteligente y segura entre botones «Ocultar» y «Cancelar».

- [x] **v1.1.6**
  - **Identidad SMTC Nativa de Prisma y Portadas HD**:
    - Integración en Rust de la API nativa System Media Transport Controls vinculada al HWND de `prisma.exe`, reemplazando el proceso genérico de WebView en el control multimedia de Windows 10/11.
    - Extracción dinámica y rotación de carátulas de alta resolución desde metadatos ID3/FLAC para proyección nítida en el overlay del sistema.
  - **Ergonomía de Volumen, Paleta Cromática y Transporte**:
    - Botón interactivo de alternancia rápida de silencio (`.preview-volume-btn`) en la barra inferior con memoria del nivel previo, icono `volume-mute` y atajo `M`.
    - Barra de progreso con acento tonal coordinado de carátula (`activeColor={palette?.accent}`).
    - Paleta adaptativa de álbum estabilizada al archivo activo (`currentAudioPath`), eliminando parpadeos cromáticos al pausar o reanudar.
    - Sincronización continua de metadatos y controles multimedia SMTC de Windows tanto para música como para vídeo.
    - Desacoplamiento de teclas multimedia de volumen de hardware (`VolumeUp`, `VolumeDown`, `Mute`) para operar con total exclusividad sobre el volumen maestro de Windows, previniendo atenuación accidental en Prisma.
    - Eliminación de bloqueos y parpadeo de opacidad en botones de transporte (play/pause/anterior/siguiente) desacoplando el estado `busy`.
    - Conmutación selectiva de Volume OSD: restringido exclusivamente a reproducción de vídeo nativo, manteniendo la reproducción musical completamente limpia y sin avisos invasivos.
  - **Empaquetado Universal y Portabilidad del Binario**:
    - Inclusión nativa de `libunwind.dll` en el instalador NSIS y en el directorio de salida del target Rust (`build.rs`), erradicando fallos por DLL faltante en instalaciones limpias de Windows.
  - **Ergonomía de Reproducción, Colas y Controles de Vídeo**:
    - Reubicación ergonómica del botón del Ecualizador en la cabecera del reproductor de vídeo (en el centro, entre Favoritos y Papelera).
    - Selector de pistas de audio reposicionado junto a la cola en el extremo inferior derecho; botón de captura de fotogramas en el lateral inferior izquierdo.
    - Eliminación de bordes y destellos en elementos activos de la cola de reproducción en `playback-queue.css`, implementando interacción táctil limpia de Material 3 con micro-escalado suave.
    - Preservación ininterrumpida de reproducción en Picture-in-Picture (PiP) al cerrar o minimizar la ventana principal.
  - **Fidelidad y Verificación Acústica en el Visualizador DSP**:
    - Activación reactiva del visualizador de espectro gobernada por detección de amplitud real (`peak_amp >= 0.0025` ~ -52 dB en Rust WASAPI) para sincronizar únicamente ante sonido verificado (música, vídeo, YouTube, TikTok o audio del sistema).
    - Modo inactivo completamente apagado: barras planas de reposo a 3px en la línea base sin brillo ni oscilación al pausar o detener la reproducción.
    - Limpieza visual del indicador de factor Q en el ecualizador paramétrico eliminando etiquetas LaTeX raw `(Q = 1.527)`.
  - **Gestión Avanzada en Colección de Favoritos**:
    - Badge flotante en hover con botón interactivo de corazón y menú contextual anticlic para desmarcar o gestionar pistas de audio, imágenes y vídeos de forma inmediata, con soporte resiliente incluso para archivos inexistentes o movidos en disco.
  - **Navegación Secuencial Multiformato en Quick Look y Encolado Inteligente de Música Externa**:
    - Exploración secuencial continua de imágenes, vídeos, pistas de audio y documentos dentro de la misma carpeta mediante atajos de teclado (`ArrowLeft` / `ArrowRight`, `PageUp` / `PageDown`) y botones flotantes laterales en la ventana sin salir de la vista previa.
    - Invalidación reactiva de caché al sustituir o editar archivos en caliente (`modifiedMillis`).
    - Encolado inteligente al abrir pistas de audio externas: escaneo de canciones en la carpeta inmediata con orden natural, asignación del nombre de la carpeta contenedora a la cola y reproducción circular continua comenzando por la canción elegida como #1.
  - **Copia al Portapapeles y Ergonomía en Visor de Imágenes y Galería**:
    - Copia directa de imágenes al portapapeles (`Ctrl + C`, botón central en cabecera y menú de herramientas) lista para pegar en mensajería o editores externos.
    - Acción «Copiar imagen» en el menú contextual de la cuadrícula de la galería.
    - Ocultamiento automático de barras de herramientas tras 3 segundos de inactividad garantizado en imágenes panorámicas 16:9 y verticales, con desvanecimiento inmediato al pulsar en área libre.
  - **Proyección de Vídeo con OSDs Universales y Atajos Canónicos**:
    - Atajos de navegación `←` / `→` para saltar de vídeo (como `P` / `N`) y `Mayús + ←` / `Mayús + →` para saltos temporales de 10s con animación direccional Seek OSD.
    - Desacoplamiento total de indicadores OSD respecto al aspect ratio del vídeo: Seek OSD anclado a los laterales de pantalla y Volume OSD en la esquina superior derecha, respondiendo con posicionamiento fijo sin invadir fotogramas verticales ni cuadrados.
  - **Refinamiento de Modo Fijado (*Pin Always-on-Top*) y Blindaje en Vídeo**:
    - Fijación nativa de Quick Look en primer plano (`set_always_on_top`) inmune a desenfoques, cambio de ventanas o pulsaciones en otras aplicaciones del sistema operativo.
    - Actualización reactiva de la vista previa al pulsar `Espacio` sobre otro archivo en el Explorador de Windows manteniendo la ventana fijada abierta.
    - Reseteo atómico de estado fijado al ocultar la ventana (`hide()`), erradicando estados zombis o bloqueos en futuras invocaciones de Quick Look.
    - Eliminación absoluta de parpadeos y recentrados al reproducir clips MKV ejecutando `ffprobe` de forma invisible (`CREATE_NO_WINDOW`) y reutilizando dimensiones en el payload.
  - **Reinicio Desacoplado y Seguro desde la Bandeja del Sistema (*System Tray*)**:
    - Liberación explícita del mutex de instancia única (`tauri_plugin_single_instance::destroy`) y ejecución de supervisor desacoplado para relanzar la aplicación de manera limpia e instantánea sin colisiones de proceso.
  - **Calibración del Espectro DSP y Ergonomía de Presets Acústicos**:
    - **Sincronización Total del Espectro Acústico**: Eliminación de la bifurcación excluyente en `DspEqualizerView` para que las barras dinámicas del visualizador oscilen fluidamente tanto con la reproducción interna de Prisma (Música y Vídeos) como con fuentes globales de audio del sistema (WASAPI Loopback).
    - **Optimización Geométrica de Presets**: Retiro definitivo del badge «Stock» en los perprofiles de fábrica y cálculo matemático exacto de altura (7 presets a 36px con 298px max-height) para garantizar que los 7 presets base queden completamente visibles con holgura y sin barra de scroll vertical.
    - **Estilo Tonal Material 3**: Integración de acentos tonales dinámicos con `--primary` para el selector de preset activo.

- [x] **v1.1.5**
  - **Delegación de Edición Quick Look → Editor Integrado Prisma**:
    - Conexión del flujo de edición entre Quick Look y la suite principal: al pulsar el botón de edición (`[✏️]`) en documentos Markdown o de texto plano, la acción delega instantáneamente a `DocumentViewer` en la ventana principal de Prisma.
    - Apertura directa en modo edición (`split` para Markdown, `code` para texto) con autoenfoque reactivo del `<textarea>` para comenzar a escribir o pegar (`Ctrl + V`) inmediatamente.
    - Persistencia ágil en disco mediante atajo `Ctrl + S` y botones de acción rápida en cabecera y barra de utilidades de Quick Look.
    - Estado de vista previa enriquecido para documentos vacíos con botón directo para redactar o insertar contenido.
  - **Aurora Synapse: Recepción no Invasiva, Notificaciones Nativas y Menú «Enviar con Aurora Synapse»**:
    - Desactivación del desminimizado y apertura forzada (`bring_main_window_to_front` y `open-media`) al recibir archivos por LAN desde el móvil o Super Galería, permitiendo continuidad total del trabajo del usuario.
    - Integración de notificaciones de escritorio en Windows para informar la recepción y guardado en `Downloads/Prisma` con apertura consentida bajo demanda.
    - Registro en shell de «Enviar con Aurora Synapse» (`--synapse-send`) enlazado a `SendToSuperGalleryModal` para transferir archivos a dispositivos LAN con un clic.

- [x] **v1.1.4**
  - **Comparador Multimedia Universal (Vídeos y Música Sincronizados), Instancia Múltiple Flotante y Rescate Tray**:
    - **Comparador Multimedia Universal**: Soporte nativo para confrontación de vídeo con reproducción sincronizada dual y barra de transporte unificada (Play/Pausa, posición temporal, velocidad 0.5x–2x). Comparativa de pistas de música y audio con vinilo animado, carátulas y ecualizador reactivo. Tecnología *Hover Audio Focus* para conmutar sonido dinámicamente con el cursor. Integración directa en el reproductor de vídeo con atajo `C` y clic derecho, y botón «Comparar» en las tarjetas de duplicados de música.
    - **Restricción Estricta por Tipo de Medio**: Prevención total de colisiones entre imágenes, vídeos y audios; adaptación dinámica de ranuras vacías, selectores y diálogos de explorador. Botón de cierre global (X) en todos los estados.
    - **Resiliencia en Buscador de Duplicados**: Corrección del congelamiento de navegación al arrastrar archivos sueltos sobre la zona de escaneo.
    - **Instancia Múltiple Flotante (Pin)**: Exclusiva para imágenes y vídeos, con fijación en primer plano (*Always-on-Top*), sin duplicar iconos en la barra de tareas de Windows (`skip_taskbar: true`), oculta en instancias secundarias y con intercambio continuo y fluido desde el Explorador de Windows sin pérdida de foco.
    - **Blindaje de Renderizado Quick Look**: Incorporación de `QuickLookErrorBoundary` para aislamiento de excepciones en visores, soporte de estados de error/carga en `QuickLookImage` con botón de reintento interactivo, decodificación segura (`decoding="auto"`) y atajo de recarga rápida (`F5` / `Ctrl + R`).
    - **Opción de Rescate en Bandeja de Sistema**: Acción «Reiniciar Prisma» (`app.restart()`) en el menú del System Tray para refrescar la app al vuelo ante cualquier eventualidad.
    - **Soporte de Códecs y Estabilidad**: Compatibilidad extendida para vídeo QuickTime `.mov` (CineForm/Apple ProRes) con proxy transparente en caché ultrarrápida y corrección del atajo `Escape` en el reproductor de vídeo principal.

- [x] **v1.1.3**
  - **Super-Resolución Neuronal por IA en Segundo Plano (Prisma Upscaler Vulkan)**:
    - Inferencia nativa y silenciosa (`realesrgan-ncnn-vulkan.exe`) con flag `CREATE_NO_WINDOW`, ejecutando super-resolución por GPU sin abrir consolas ni ventanas externas.
    - Tiling adaptativo anti-OOM (64 ➔ 32) para estabilidad en cualquier GPU (integradas AMD Radeon 780M / Intel Iris y dedicadas NVIDIA RTX / AMD Radeon).
    - Redimensionamiento Lanczos3 de alta fidelidad para factores 2x y 3x preservando la máxima fidelidad en bordes y texturas.
    - Visualizador interactivo de super-resolución (`UpscaleComparisonSlider`): deslizador de pantalla dividida (*Split Slider*), cronómetro en vivo y acciones directas («Abrir Carpeta», «Volver a Escalar» y «App Desktop»).
  - **Buscador de Duplicados: Comparativa Cruzada Estricta y Modo Compacto Dual**:
    - Comparativa cruzada estricta (Base vs Depurar) en Rust: discriminación de origen (`classify_path`), eliminación de falsos positivos intra-carpeta (evita comparar archivos de Base contra Base o Depurar contra Depurar) tanto en hash exacto como en similitud perceptual visual (dHash) y acústica (Lofty).
    - Barra compacta dual inteligente al seleccionar carpetas: reducción de más del 60% de la altura vertical de la cabecera (de ~130px a ~44px), con cápsulas tonales (Base intacta en verde esmeralda y A Depurar en naranja vibrante), rutas legibles, intercambio instantáneo (`⇄`), soporte de arrastrar y soltar nativo y conmutador de expansión/colapso.
  - **Suite de Comparación de Imágenes: Ranura de Espera, Selector Compacto y Drag & Drop Universal**:
    - Ranura interactiva vacía para Slot B con zona de soltado y botones para Biblioteca y Explorador, eliminando el emparejamiento aleatorio al abrir comparaciones.
    - Modal intermedio compacto (`ImageComparisonSourceModal`) para añadir o cambiar fotos con soltado directo y selector ligero de fuentes.
    - Soporte nativo de Arrastrar y Soltar (*Drag & Drop*) Win32/Tauri v2 en todas las ranuras, selectores y mitades de pantalla activas.
    - Filtrado por carpetas en selector, miniaturas nativas con caché LRU y renderizado progresivo por lotes.
  - **Personalización y Variantes de Color de Fondo**:
    - Variantes de fondo reactivas en Configuración (`prisma`, `neutral`, `miku`).

- [x] **v1.1.2**
  - **Buscador y Comparador de Duplicados Multimodal (Imágenes, Vídeos y Música), Hero Dropzone Central y Quick Look Ampliado**:
    - Motor multimodal de duplicados con conmutador tri-modal (`[🎵 Música]`, `[🖼️ Imágenes]`, `[🎬 Vídeos]`).
    - Detección acústica inteligente para música: pipeline híbrido de dos niveles (Hash binario exacto en streaming y metadatos Lofty normalizados con tolerancia temporal de duración $\pm 3.5\text{ s}$).
    - Scoring Hi-Res de audio: priorización automática de formatos sin pérdida (FLAC, WAV, ALAC con 1,000,000 pts base) y tasas de bits superiores (320 kbps) para conservar la mejor versión de audio y depurar copias comprimidas.
    - Detección por hash y similitud perceptual (dHash 64 bits con tolerancia porcentual) para imágenes y vídeos, con visor de comparación interactivo frente a frente integrado (`ImageComparisonModal`).
    - Comparativa cruzada de 2 carpetas (Base vs Depurar) para proteger una carpeta base intacta y depurar o actualizar carpetas externas.
    - Acciones flexibles en lote e individuales: selección masiva por grupo tri-state (`[-]`, `[✓]`, `[ ]`), traslado a carpeta de respaldo o cuarentena y envío directo a la papelera del sistema (`trash`).
    - Hero Dropzone Central interactivo y barra compacta de 36 px: eliminación del espacio superior desperdiciado, haciendo que todo el cuadro central vacío sirva como zona de arrastre y clic para examinar carpetas, dejando el 100% de la altura de pantalla libre para explorar duplicados.
    - Hero Dropzone interactivo aplicado a la cola vacía del Convertidor Prisma.
    - Pestaña «Herramientas» en Configuración para conmutar la visibilidad modular de utilidades integradas y acceso directo a Duplicados en la barra lateral principal.
    - Quick Look para Documentos, PDFs, Libros y archivos comprimidos (.zip) con dimensionamiento reactivo al 70% de ancho y 80% de alto del monitor, botón «Editar» en editor predeterminado de Windows y botón «Abrir» en DocumentViewer.
    - Arrastrar y Soltar (Drag & Drop) universal restaurado en toda la suite sin bloqueos de cursor ni restricciones.
    - Soporte nativo OLE de arrastre de carpetas en herramientas (Renombrador, Conversor y Duplicados) mediante receptor Win32 `IDropTarget` (`CF_HDROP`) con re-registro dinámico al enfocar la ventana.
- [x] **v1.1.1**
  - **Quick Look: Precisión de Dimensiones, Apertura Fluida con Póster Nativo, Cache-Busting y Soporte para Archivos Sobrescritos**:
    - Corrección del GUID de `PKEY_VIDEO_FRAME_WIDTH`/`HEIGHT` en Windows Shell (`0x64440491`), límites de seguridad de resolución y fallback nativo a `ffprobe` para prevenir ventanas desproporcionadas.
    - Generación nativa de póster en el primer fotograma (`video_poster_url`) para apertura instantánea y eliminación del parpadeo negro, con tamaño de ventana inicial discreto y adaptativo (`560x360`).
    - Cache-busting dinámico (`?v=${size}_${modified}`) y liberación de streams para resolver la pantalla negra al previsualizar vídeos re-renderizados o sobrescritos desde DaVinci Resolve.
    - Tarjeta de error amigable con botón de reintento y acción «Abrir en reproductor completo».
    - Adopción de perfiles ligeros `[profile.dev]` y scripts `cargo sweep` según la Documentación Core, liberando más de 39 GB en el directorio `target/`.
- [x] **v1.1.0**
  - **Convertidor Multimedia por Lotes, Calidad Lossless Dedicada (FLAC/WAV) y Selectores M3 Expressive**:
    - Motor ampliado de conversión por lotes con integración FFmpeg nativa para extracción de vídeo a audio multiformato (MP3, FLAC, WAV, AAC, OGG, M4A), transcodificación de vídeo (H.264, HEVC/H.265, AV1, copia directa de stream y reescalado de resolución) y transcodificación de audio.
    - Soporte canónico y especializado para audio sin pérdida (*Lossless*): eliminación de bitrates con pérdida en FLAC y WAV, aplicando compresión lossless máxima Nivel 8 bit-perfect para FLAC y codificación PCM de 24 bits Hi-Res / 16 bits CD para WAV.
    - Estandarización del componente de selector personalizado `CustomSelect` (Material 3 Expressive) en todo el Convertidor Prisma, sustituyendo controles predeterminados del sistema por menús desplegables con micro-animaciones fluidas, elevación contextual `z-index`, rotación de chevron y marca de verificación activa.
    - Formalización de `CustomSelect.tsx` y `custom-select.css` en `src/shared/ui/` como átomo reutilizable centralizado del proyecto con soporte para temas dinámicos claro y oscuro.
    - Unificación del control del Ecualizador DSP en `VideoPlayer` con conmutación física de salida de audio en tiempo real (`setSinkId`), elevación de capas a prueba de solapamientos (`z-index: 100010`) y desconexión segura de pantalla completa al abrir ajustes acústicos.
    - Perfeccionamiento dinámico del toast de captura de fotogramas (`.video-snapshot-toast`), adaptando su anclaje a 28 px sin controles y 136 px con controles activos, más optimizaciones de rendimiento en Quick Look.
- [x] **v1.0.9**
  - **Captura de Fotogramas (Snapshot estilo VLC), Navegación Cuadro a Cuadro y Destino de Assets**:
    - Captura nativa del fotograma activo de vídeo a resolución completa (sin pérdida ni degradación) en formatos PNG, WebP y JPEG, con nombres estructurados y timestamp (`Prisma_snap_[título]_[tiempo].[ext]`).
    - Navegación cuadro a cuadro precisa con atajos <kbd>F</kbd> (+1 fotograma) y <kbd>Shift</kbd> + <kbd>F</kbd> (-1 fotograma), junto con soporte secundario <kbd>E</kbd> / <kbd>Shift + E</kbd> y teclas coma / punto (<kbd>,</kbd> / <kbd>.</kbd>).
    - Configuración en Ajustes > General para seleccionar la carpeta de destino personalizada (o restablecer a Imágenes de Windows) y el formato predeterminado mediante chips interactivos.
    - Notificación flotante con miniatura, tiempo exacto y botón «Mostrar» calibrada verticalmente sobre la barra de reproducción para evitar bloqueos del depurador de tiempo, e integración nativa con Windows Explorer mediante `/select,` para resaltar el archivo recién guardado.
- [x] **v1.0.8**
  - **Modo DSP Global de Sistema, Graves Dual-Mono, Ruteo Universal, Descargador de Letras Sincronizadas y Continuidad Acústica**:
    - Motor nativo puro en Rust de captura y renderizado en tiempo real con latencia ultrabaja (~10 ms) mediante WASAPI Loopback para interceptar y procesar el audio de todo Windows (YouTube en Chrome/Edge, Spotify, navegadores y videojuegos).
    - Análisis y calibración matemática inspirada en la arquitectura FxSound con limitador predictivo *lookahead* a -0.17 dBFS y compresión suave RMS sin clipping ni distorsión por sobrecarga.
    - Algoritmo de pegada de graves centrado en fase (*Dual-Mono HyperBass* a 90 Hz $Q=2.5$ y 55 Hz $Q=2.2$ tras el ensanchamiento estéreo), eliminando fugas hacia los laterales.
    - Ruteo universal compatible con `MIXLINE`, DACs, altavoces y auriculares, con exclusión del propio endpoint de Prisma para evitar bucles.
    - Descargador masivo por lotes de letras sincronizadas con timestamps (`.lrc` para Karaoke) vía LRCLIB, con limpieza automática de títulos, omisión de pistas existentes, escritura de archivos compañeros en UTF-8 y panel de monitoreo interactivo.
    - Arquitectura persistente `DspProvider` y sincronización en memoria en Rust (`matches_devices`) para reproducción ininterrumpida sin micro-cortes al navegar entre pestañas.
    - Motor Web Audio API de alta fidelidad conectado al reproductor de vídeo HTML5 con preservación de filtros en modo Picture-in-Picture.
    - Actualización oficial del lema e identidad: *Prisma · Tu espacio de multimedia* y *Prisma Audio Enhancer (Prisma Audio Engine)*.
- [x] **v1.0.7**
  - **Renombrador Masivo con Reglas Apiladas, Sincronización Synapse LAN/P2P, Motor Nativo Rust y Estandarización de Scripts**: Rediseño ergonómico del Renombrador Masivo con disposición "un elemento por línea", menús desplegables de ancho completo y panel de plantillas; soporte integral de deep links y Handoff móvil en Aurora Synapse con balizas UDP automáticas; motor de conversión de imágenes nativo en Rust puro (`Lanczos3`) para WebP/PNG/JPG; iconografía oficial actualizada y adopción del estándar universal de scripts y alias de compilación en `package.json`.
- [x] **v1.0.6**
  - **Quick Look Multiformato, Inspector EXIF Nativo, EPUB/ZIP y Visor Enriquecido**: Navegación continua con flechas sin robo de foco (`SW_SHOWNOACTIVATE`), previsualización estructurada de archivos ZIP/7Z/RAR con búsqueda, soporte de libros EPUB con portada 3D y capítulos, motor nativo puro de EXIF fotográfico, panel lateral de información técnica en el visor de fotos (`I`), alternancia reactiva de colas musicales y renderizado fluido sin recortes artificiales.
- [x] **v1.0.5**
  - **Menús de Herramientas Modulares, Zoom Ultra Amplio (5%), Suite de Comparativa A/B e Integración Nativa**: Menús desplegables con diseño glassmorphic en imágenes y vídeos, persistencia inteligente de controles en pantalla, zoom fotográfico desde el 5% con desplazamiento suave, alineación compacta en comparativa A/B, comando nativo de selección en el Explorador de Windows y nuevo icono de alto contraste con fondo blanco.
- [x] **v1.0.4**
  - **Inicio Estable, Wallpapers Aurora Adaptables y Música Consistente**: carga inicial escalonada, posiciones estables en Inicio, visor de wallpapers proporcional, defensas para recursos no autorizados, metadatos musicales respetados, colas refinadas y estados interactivos coherentes. Publicación confirmada por Biglex el 24 de agosto de 2026.
- [x] **v1.0.3**
  - **Wallpapers Bento con Títulos en Hover, Visor Maximizado 80%x90%, Micro-interacciones Táctiles y Contraste Adaptativo**: Perfeccionamiento visual del catálogo de Wallpapers Aurora con tarjetas limpias en reposo y títulos/metadatos animados en hover, visor modal maximizado al 80% de ancho y 90% de alto de pantalla sin franjas residuales, físicas de resorte en transporte multimedia, corrección integral de contraste e inversión cromática de textos en botones para modo Claro y Oscuro, transiciones asíncronas de vídeo sin pausas ni desaparición de cursor, simplificación del visor de letras y centralización de versión.
- [x] **v1.0.2**
  - **Suite de Comparativa de Imágenes, Modo Desarrollo Aislado, Bento Grid 12-Columnas y Suite Musical Aurora Online**: Suite de Comparativa de Imágenes Multimodal (Cortina Deslizante, Lado a Lado, Alternancia Rápida a 60 Hz y Diferencia/Relieve) con zoom pareado al 500%, desacople de ventanas de Quick Look independientes, modo de desarrollo concurrente con aislamiento de perfil (`dev_profile/`), Bento Grid denso adaptable para Wallpapers 4K, suite online desglosada en Música, Instrumentales y Karaokes con test de ping en tiempo real, y optimización de renderizado en `MediaProgressBar` con `ResizeObserver` sin parpadeos ni layout thrashing.
- [x] **v1.0.1**
  - **Ecosistema Luna Fetch & Gallery-DL, Aurora Synapse Apps Hub, Convertidor por Lotes y Álbumes Inteligentes**: Centros de herramientas dedicados para Luna Fetch y Gallery-DL GUI con analizador y envío rápido de enlaces o galerías masivas con 4 estructuras de carpetas, panel de aplicaciones vinculadas en Aurora Synapse con iconos empaquetados y estado de sinergia, integración del Convertidor Prisma con soporte por lotes y carpetas completas, menú contextual para conversión directa, agrupación de música por etiquetas de álbum con vista de detalle dedicada, doble interacción en tarjetas, selector de densidad de altura en configuración y perfeccionamiento de alta precisión en Quick Look para Windows 11 con pestañas.
- [x] **v1.0.0**
  - **Lanzamiento oficial de Prisma**: Estación multimedia local-first integral para Windows. Reproducción de audio de alta fidelidad, reproductor de vídeo con PiP, visor y editor de imágenes, Quick Look universal, **Bibliotecas Modulares Personalizables** con lector y editor interactivo in-app (*Split View*, fuentes y zoom), **Editor de Tags ID3/Metadatos (Prisma Tag Editor)**, **Editor Visual y Sincronizador de Letras LRC (LyricsEditor)**, **Visor de Metadatos EXIF fotográfico**, listas universales M3U/PLS/XSPF y control remoto LAN mediante Aurora Synapse.

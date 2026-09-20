# Plan de Implementación: Barra de Progreso Ondulada y Clásica (Estilo Supergalería / Lienzo Gallery)

## Objetivo
Portar el sistema de barra de progreso de **Supergalería** (`D:\Proyectos\biglexj\Lienzo--Gallery`) a **Prisma**, implementando dos modalidades:
1. **Ondulada (`wavy`)**: Animación de onda senoidal en tiempo real durante la reproducción (Material 3 Expressive), atenuación sutil en el extremo inactivo y deslizador de cápsula vertical. **Modo predeterminado**.
2. **Clásica (`classic`)**: Barra de progreso lineal tradicional continua con deslizador suave.

Ambas modalidades serán seleccionables desde **Configuración** (`AppSettings`) y se aplicarán automáticamente a:
- **Reproductor de Música / Mini Reproductor** (`PlaybackPreview`)
- **Reproductor de Vídeos** (`VideoPlayer`)
- **Quick Look Audio** (`QuickLookMusic`)
- **Quick Look Vídeo** (`QuickLookVideo`)

---

## 1. Arquitectura y Componentes

### A. Componente Compartido: `MediaProgressBar`
- **Ruta**: `src/shared/ui/MediaProgressBar.tsx` y `src/shared/ui/media-progress-bar.css`.
- **Modo Ondulado (`wavy`)**:
  - Renderizado por `<canvas>` de alto rendimiento con `requestAnimationFrame` y adaptación a Retina/HiDPI (`window.devicePixelRatio`).
  - **Lado Activo (Reproduciendo)**: Función de onda senoidal dinámica:
    $$y(x) = \text{centerY} + \sin\left(\frac{x}{\lambda} \cdot 2\pi - \text{fase}\right) \cdot A$$
    ($A = 3\text{px}$, $\lambda = 28\text{px}$, fase continua $0 \to 2\pi$ a ~1400ms).
  - **Lado Inactivo (Reproduciendo)**: Atenuación suave de onda ($1.3\text{px} \to 0\text{px}$ en un tramo de $36\text{px}$) seguida de línea recta hasta el final.
  - **Pausado**: Líneas rectas limpias tanto en la sección activa como inactiva.
  - **Thumb / Indicador**: Cápsula vertical redondeada de $4\text{px} \times 16\text{px}$ en blanco / on-primary.
  - **Interacción fluida**: Scrubbing / arrastre táctil y con ratón con captura de puntero (`setPointerCapture`), actualización visual en tiempo real durante el arrastre, soporte de clics instantáneos y teclas de flecha.
- **Modo Clásico (`classic`)**:
  - Pista lineal estilizada con relleno de acento y cápsula/thumb Material 3.

### B. Gestión de Configuración: `useSystemSettings`
- Añadir `progressBarStyle: "wavy" | "classic"` a `SystemSettings`.
- Valor por defecto: `"wavy"`.
- Persistencia en `localStorage` (`prisma.system-settings.v1`).
- Soporte para emisión y escucha de cambios en tiempo real (mediante `CustomEvent` / `storage` event) para que todas las vistas y ventanas reaccionen al instante sin recargar.

### C. Panel de Configuración: `AppSettings.tsx`
- Añadir sección de **Barra de Progreso** dentro de "General y Sistema":
  - Opciones tipo chips / tarjetas Material 3 Expressive:
    - **Ondulada (Por defecto)**: "Onda fluida animada durante la reproducción".
    - **Clásica**: "Línea continua tradicional con control deslizante".

### D. Integración en Reproductores
1. `src/features/playback/ui/components/PlaybackPreview.tsx` (Música y panel flotante).
2. `src/features/visual_library/ui/VideoPlayer.tsx` (Visor y reproductor completo de vídeo).
3. `src/features/quick_look/ui/QuickLookMusic.tsx` (Visor de audio Quick Look).
4. `src/features/quick_look/ui/QuickLookVideo.tsx` (Visor de vídeo Quick Look).

---

## 2. Plan de Verificación
- Comprobar cambio de estilo en tiempo real en Configuración.
- Verificar animación ondulada fluida en reproducción de música y vídeo.
- Verificar transición a línea recta al pausar.
- Probar arrastre (scrubbing) y clic en diferentes resoluciones y tamaños de ventana.
- Ejecutar `tsc --noEmit` y `npm run build` para asegurar integridad de TypeScript y empaquetado.

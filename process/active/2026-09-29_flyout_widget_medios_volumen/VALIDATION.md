# Validación — Flyout & Widget de Escritorio para Medios y Volumen

- Proceso: `process/active/2026-09-29_flyout_widget_medios_volumen/`
- Estado: `EN CURSO`
- Fecha: `2026-09-29`

## Criterios de Aceptación

1. **Ventana e Integración**:
   - [ ] La ventana secundaria `flyout` se instancia con transparencia real y sin marco del sistema operativo.
   - [ ] No genera icono en la barra de tareas (`skipTaskbar: true`).
2. **Posicionamiento Paramétrico**:
   - [ ] Permite cambiar dinámicamente entre las 6 zonas de pantalla: `bottom-left`, `bottom-center`, `bottom-right`, `top-left`, `top-center`, `top-right`.
   - [ ] El posicionamiento respeta el margen de la barra de tareas de Windows (usando el área de trabajo real del monitor).
3. **Reproducción de Medios**:
   - [ ] Muestra la carátula o miniatura del vídeo en alta calidad sin retraso ni caídas de imagen.
   - [ ] Los botones Anterior, Play/Pause y Siguiente controlan directamente la sesión activa de Prisma.
4. **Volumen & Visualizador**:
   - [ ] El nivel de volumen y el botón de silencio se actualizan bidireccionalmente.
   - [ ] El visualizador de espectro reacciona al sonido.
   - [ ] Permite fijar el widget con el botón Pin para que no se oculte tras el tiempo de expiración.

## Evidencia de Validación

- **Compilación Frontend (`bun run build`)**: Exitosa en 3.69s (`tsc --noEmit && vite build`) sin errores.
- **Compilación Rust (`cargo check`)**: Exitosa en 14.12s sin errores ni warnings.
- **Intercepción Teclado**: Hook de teclado `WH_KEYBOARD_LL` actualizado para capturar `0xAD` (mute), `0xAE` (volumen abajo), `0xAF` (volumen arriba) y notificar al backend en 0 ms.
- **Lectura/Escritura de Volumen de Windows**: Integración nativa mediante `IAudioEndpointVolume` (COM API) en [flyout.rs](file:///D:/Proyectos/biglexj/Prisma/src-tauri/src/app/commands/flyout.rs).
- **Legibilidad y Contraste**: Sustitución de hiper-transparencia por acrílico Fluent de alta opacidad (96%) en [flyout-window.css](file:///D:/Proyectos/biglexj/Prisma/src/features/playback/ui/flyout-window.css) con textos en Slate 900 `#0f172a` y Slate 700 `#334155` en modo claro, garantizando máxima legibilidad.
- **Commit de Resguardo**: `c6adb66` (*checkpoint: session 2026-09-29 - flyout teclado volumen nativo y contraste alto claro oscuro*).

# Salidas de Audio Múltiples Simultáneas — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Implementar un sistema de enrutamiento y duplicación de audio multi-dispositivo simultáneo en Windows (WASAPI Loopback / Bridge DSP en tiempo real), permitiendo emitir el flujo de sonido concurrentemente hacia dos o más puntos finales físicos (ej. altavoces principales de escritorio, auriculares y altavoz Bluetooth portátil), con interfaz intuitiva dentro del Ecualizador / DSP y atajo de teclado para conmutación rápida.

## Alcance

- Incluye:
  - **Backend Nativo (Rust + WASAPI)**:
    - Extensión de `PassthruService` y `WasapiBridge` para inicializar y sincronizar múltiples clientes de renderizado (`IAudioRenderClient`) sobre distintos `IMMDevice` de salida.
    - Clonado y distribución de buffers PCM flotantes (`f32`) en el hilo de audio de tiempo crítico (`THREAD_PRIORITY_TIME_CRITICAL`).
    - Conversión de formato y remuestreo de frecuencias si los dispositivos difieren en frecuencia de muestreo nativa (ej. 44.1 kHz vs 48 kHz).
    - Control de ganancia/volumen individual por dispositivo de salida y volumen maestro unificado.
  - **Comandos Tauri**:
    - `playback_get_audio_endpoints`: Lista completa de dispositivos de salida activos en Windows con indicación de ID, nombre, icono/tipo y estado.
    - `playback_set_multi_output`: Configuración de lista de dispositivos de salida concurrentes activos con sus ganancias relativas.
    - `playback_toggle_multi_output`: Activación/desactivación instantánea del modo multi-salida.
  - **Interfaz de Usuario (React + Material 3 Expressive)**:
    - Nueva sección «Salidas Múltiples» en la vista de Ecualizador / DSP (`EqualizerView.tsx` / `AudioSettingsModal.tsx`).
    - Selector visual de dispositivos con interruptores individuales tipo pill, medidor de señal y deslizador de volumen por dispositivo.
    - Indicador flotante (badge OSD) que muestra cuando el audio se encuentra enrutado a múltiples destinos.
  - **Atajo de Teclado**:
    - Atajo de conmutación rápida (ej. `Ctrl+Alt+O` o `Alt+M`) para alternar la duplicación de audio hacia los dispositivos secundarios preconfigurados.
- No incluye:
  - Soporte ASIO exclusivo ni drivers propietarios de terceros (se utiliza WASAPI estándar compartido por máxima estabilidad y cero dependencias externas).

## Enfoque

1. **Fase 1: Motor Multi-Endpoint en Rust**:
   - Refactorizar `wasapi_passthru.rs` para permitir un vector de `ActiveRenderEndpoint` en lugar de un único `render_client`.
   - Gestionar el ciclo de escritura de buffers duplicados con tolerancia a jitter y desincronización por latencia de buffers (resincronización por timestamps de reloj multimedia).
2. **Fase 2: Capa de Comandos y Persistencia**:
   - Exponer la configuración a través de comandos IPC de Tauri y guardar la selección en las preferencias locales (`useSystemSettings`).
3. **Fase 3: Interfaz de Usuario en Ecualizador**:
   - Diseñar la tarjeta interactiva de salidas múltiples con diseño tonal Material 3, micro-animaciones de conexión y estado de latencia estimada.
4. **Fase 4: Atajo Global y OSD**:
   - Integrar la alternancia con atajo de teclado y notificación flotante OSD en `App.tsx`.

## Criterios de finalización

- [ ] Reproducción simultánea verificable en al menos 2 dispositivos de audio distintos conectados a Windows (ej. altavoz Realtek + auriculares USB/Bluetooth).
- [ ] Sin distorsión, clics de buffer (underruns) ni desincronización acumulativa entre salidas.
- [ ] Control individual y maestro de volumen por salida en la UI del Ecualizador.
- [ ] Atajo de teclado funcional para alternar el modo multi-salida con feedback OSD visible.
- [ ] `bun run check` (0 errores) y suite Rust (`cargo test --features mpv`) superados.

## Autorización

- [ ] Plan aprobado para ejecución por Biglex.

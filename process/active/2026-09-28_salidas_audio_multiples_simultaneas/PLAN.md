# Salidas de Audio Múltiples Simultáneas — Plan

- Estado: `IN_PROGRESS`
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
    - Retardo manual individual de 0 a 2000 ms para alinear salidas cableadas y Bluetooth, incluida la salida principal.
  - **Comandos Tauri**:
    - `playback_get_audio_endpoints`: Lista completa de dispositivos de salida activos en Windows con indicación de ID, nombre, icono/tipo y estado.
    - `playback_set_multi_output`: Configuración de lista de dispositivos de salida concurrentes activos con sus ganancias relativas.
    - `playback_toggle_multi_output`: Activación/desactivación instantánea del modo multi-salida.
  - **Interfaz de Usuario (React + Material 3 Expressive)**:
    - Selector compacto «Salidas múltiples» en la cabecera del Ecualizador / DSP (`DspEqualizerView.tsx`) con panel flotante desplegable que no desplaza el visualizador.
    - Casillas por dispositivo, indicador de señal común, volumen y retardo por dispositivo. El retardo avanza 10 ms con cada flecha o pulsación.
    - Estado de conexión visible en el selector y aviso breve al usar el atajo, sin indicador permanente sobre otras vistas.
  - **Atajo de Teclado**:
    - Atajo local `Ctrl+Mayús+O` y segundo atajo global `Ctrl+Mayús+Alt+P` para alternar la duplicación aun con otra aplicación en primer plano. Biglex aprobó P el 29 de septiembre: O colisionaba con AutoHotkey (`aurora-stop all`).

## Recuperación de dispositivos — 29 de septiembre

- Conservar preferencias de volumen y retardo de salidas desconectadas; no rechazar la restauración completa por un dispositivo ausente.
- Resolver la principal siguiendo el selector base y usar únicamente salidas físicas disponibles en el motor.
- Mantener la intención de duplicación cuando queda una sola salida, para recuperar las secundarias al volver a conectar.
- Desacoplar secundarias que fallan sin detener la principal; recuperar cambios de principal mediante el reconciliador existente.
- Presentar avisos breves de audio y disponibilidad del atajo, dejando el detalle técnico en los registros.
- No incluye:
  - Soporte ASIO exclusivo ni drivers propietarios de terceros (se utiliza WASAPI estándar compartido por máxima estabilidad y cero dependencias externas).
  - Calibración automática de latencia: requiere una medición fiable por dispositivo y queda como mejora posterior.

## Enfoque

1. **Fase 1: Motor Multi-Endpoint en Rust**:
   - Refactorizar `wasapi_passthru.rs` para permitir un vector de `ActiveRenderEndpoint` en lugar de un único `render_client`.
   - Gestionar una cola y una fase de remuestreo por salida, con ajuste suave según el llenado del búfer para compensar la diferencia entre relojes.
2. **Fase 2: Capa de Comandos y Persistencia**:
   - Exponer la configuración a través de comandos IPC de Tauri y guardar la selección en las preferencias locales (`useSystemSettings`).
3. **Fase 3: Interfaz de Usuario en Ecualizador**:
   - Diseñar un selector desplegable de salidas múltiples con diseño tonal Material 3, casillas, ganancias e indicación del búfer principal.
4. **Fase 4: Atajo y aviso**:
   - Integrar la alternancia con atajo de teclado y aviso breve en `App.tsx`.

## Criterios de finalización

- [ ] Reproducción simultánea verificable en al menos 2 dispositivos de audio distintos conectados a Windows (ej. altavoz Realtek + auriculares USB/Bluetooth).
- [ ] Sin distorsión, clics de buffer (underruns) ni desincronización acumulativa entre salidas.
- [ ] Control individual y maestro de volumen por salida en la UI del Ecualizador.
- [ ] Ajuste de retardo por cada salida, incluida la principal, con pasos de 10 ms y comprobación audible.
- [ ] Atajo de teclado funcional para alternar el modo multi-salida con aviso breve visible.
- [ ] Segundo atajo global funcional con Prisma en segundo plano y aviso si otra aplicación ocupa la combinación.
- [ ] `bun run check` (0 errores) y suite Rust (`cargo test --features mpv`) superados.

## Autorización

- [x] Plan aprobado para ejecución por Biglex (indicación en esta conversación).

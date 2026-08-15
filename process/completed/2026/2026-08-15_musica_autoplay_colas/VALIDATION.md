# Validación: Autoplay y Sistema de Colas Super Gallery

## Comprobaciones Automatizadas
- [x] `cargo check` (src-tauri) -> Compiló exitosamente en 1.62s con 0 errores.
- [x] `npm run build` (frontend Vite + TypeScript) -> Compilación exitosa en 830ms con 0 errores TypeScript.

## Comprobaciones de Implementación
- [x] **Autoplay inmediato**: `MpvBackend::load` despausa explícitamente (`pause = false`) al cargar una pista, iniciando el sonido de inmediato sin pulsar Play adicionalmente.
- [x] **Arquitectura multi-cola de Super Gallery**: `usePlaybackQueue` gestiona `queues`, `activeQueueId`, `playFolder`, `switchQueue`, `shuffleActiveQueue` y `rewindActiveQueue`.
- [x] **Aleatorio in-situ**: Mantiene la canción sonando en la posición 1 y baraja el resto de pistas sin perder la referencia ni el orden.
- [x] **Rebobinado circular**: Mueve la canción actual al inicio rotando circularmente el resto de la cola.
- [x] **Dimensiones idénticas para Previa, Letras y Colas**: `preview-artwork`, `lyrics-stage-container` y `playback-queue-panel` comparten `width: min(100%, 540px)`, `aspect-ratio: 1` y `border-radius: clamp(24px, 3.5cqi, 44px)`.
- [x] **Distribución expandida**: `.preview-player` cuenta con una cuadrícula equilibrada `grid-template-columns: minmax(360px, 1.05fr) minmax(380px, 1.2fr)` con ancho máximo de 1380px.
- [x] **Indicador visual en vivo**: Las tarjetas en `MusicLibrary` muestran borde iluminado y ecualizador animado en la canción activa en reproducción.

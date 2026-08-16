# Validación: Barra de Progreso Ondulada y Clásica

## 1. Verificaciones Automatizadas
- [x] TypeScript Check: `npx tsc --noEmit` (Exitoso, 0 errores)
- [x] Vite Build: `npm run build` (Exitoso, empaquetado en 2.31s)

## 2. Verificaciones de Comportamiento
- [x] **Configuración en Ajustes**:
  - Selector con vistas previas interactivas para "Ondulada" y "Clásica".
  - Cambio reactivo en tiempo real mediante eventos `prisma:settings-changed` y `storage`.
  - Valor por defecto: `"wavy"`.
- [x] **Modo Ondulado en Música**:
  - En reproducción: Onda senoidal viva ($A = 3\text{px}$, $\lambda = 28\text{px}$) y atenuación suave hacia el extremo inactivo.
  - En pausa: Línea recta fija.
  - Indicador tipo cápsula vertical blanca redondeada de tacto elegante.
- [x] **Modo Ondulado en Vídeo**:
  - En reproducción: Animación activa de onda sincronizada con el vídeo.
  - En pausa: Transición a línea continua fija.
- [x] **Interacción (Scrubbing / Búsqueda)**:
  - Arrastre fluido de la posición con captura de puntero (`setPointerCapture`) sin saltos.
  - Clic en cualquier punto de la barra salta de inmediato a la posición temporal.
  - Navegación accesible con flechas del teclado.
- [x] **Quick Look**:
  - Quick Look de audio (`QuickLookMusic`) y vídeo (`QuickLookVideo`) utilizan `MediaProgressBar` respetando la configuración activa.

## 3. Registro de Resultados
- **Rendimiento**: Renderizado óptimo a 60/120 FPS mediante `<canvas>` con adaptación para pantallas HiDPI (`window.devicePixelRatio`).
- **Integridad**: Arquitectura de componentes modular en `src/shared/ui/MediaProgressBar.tsx` sin duplicación de lógica.

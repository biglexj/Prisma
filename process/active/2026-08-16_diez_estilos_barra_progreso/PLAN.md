# Plan de Implementación: Suite Completa de 10 Estilos de Barra de Progreso

## Objetivo
Implementar una suite completa de **10 estilos de barra de progreso** interactiva y estética en Prisma, ofreciendo al usuario una experiencia de personalización multimedia vanguardista, con renderizado en Canvas a 60/120 FPS, físicas fluidas, efectos de partículas, espectros de audio, dispersión óptica y simulación analógica.

---

## Catálogo de Estilos
1. `wavy`: **Ondulada** (Onda senoidal viva continua).
2. `classic`: **Clásica** (Línea continua recta tradicional).
3. `prism`: **Haz Prismático** (Gradiente de dispersión espectral iridiscente y destellos ópticos).
4. `soundwave`: **Espectro SoundWave** (Micro-barras de ecualizador vertical moduladas por armónicos).
5. `fluid`: **Mercurio Líquido** (Gota fluida y metaball elástica con squash & stretch).
6. `helix`: **Doble Hélice Cuántica** (Ondas duales en contrafase con sombreado de profundidad 3D).
7. `neon_pulse`: **Pulso Bio-Sensor (ECG)** (Trazado electrocardiográfico con complejos P-Q-R-S-T y resplandor neón).
8. `particles`: **Estela Cósmica** (Núcleo luminoso que emite partículas flotantes con decaimiento).
9. `vinyl_tape`: **Cinta Analógica & Vinilo** (Textura de microsurcos de vinilo y cinta magnética en desplazamiento).
10. `elastic_string`: **Cuerda Elástica Tensada** (Oscilador armónico amortiguado que vibra al interactuar).

---

## Estructura Modular
- `src/shared/ui/progressRenderers.ts`: Funciones matemáticas y de dibujo en Canvas para cada estilo.
- `src/shared/ui/MediaProgressBar.tsx`: Componente base con bucle `requestAnimationFrame` continuo y captura de eventos.
- `src/app/useSystemSettings.ts`: Tipado extendido y persistencia.
- `src/app/ui/AppSettings.tsx` & `app-settings.css`: Cuadrícula con 10 tarjetas interactivas de previsualización.

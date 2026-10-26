/**
 * Entrada de la superficie web de la composición del escritorio.
 *
 * Esta ventana se cuelga del contenedor del escritorio de Windows y dibuja por
 * encima de la capa 1 (vídeo o imagen) y por debajo de la capa de iconos.
 * Capas: 2 ambiente · 3 fondos planos · 4 escenarios 3D · 5 partículas 3D · 6 partículas 2D.
 */

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { mountComposition } from "./host";
import ParticleLayer from "./aurora/particles/ParticleLayer";

const root = document.getElementById("root");

if (root) {
  // La capa 6 es un lienzo 2D propio, independiente del contexto WebGL.
  const overlayHost = document.createElement("div");
  document.body.appendChild(overlayHost);
  const overlayRoot = createRoot(overlayHost);
  const host = mountComposition(root, {
    onOverlay: state => overlayRoot.render(state ? createElement(ParticleLayer, {
      color: state.color,
      paused: state.paused,
      intensity: state.intensity,
      sizeMultiplier: state.size,
      densityMultiplier: state.density,
      speedMultiplier: state.speed,
      shape: state.shape,
      direction: state.direction,
      visualIntensity: state.opacity,
      voiceActivity: 0,
    }) : null),
  });
  const dispose = () => {
    host.dispose();
    overlayRoot.unmount();
    overlayHost.remove();
  };
  window.addEventListener("pagehide", dispose, { once: true });
  import.meta.hot?.dispose(dispose);
} else {
  console.warn("[Compositor] No se encontró el contenedor de la superficie web.");
}

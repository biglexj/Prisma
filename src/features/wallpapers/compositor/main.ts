/**
 * Entrada de la superficie web de la composición del escritorio.
 *
 * Esta ventana se cuelga del contenedor del escritorio de Windows y dibuja por
 * encima de la capa 1 (vídeo o imagen) y por debajo de la capa de iconos.
 */

import { mountComposition } from "./host";

const root = document.getElementById("root");

if (root) {
  const host = mountComposition(root);
  window.addEventListener("pagehide", () => host.dispose(), { once: true });
  import.meta.hot?.dispose(() => host.dispose());
} else {
  console.warn("[Compositor] No se encontró el contenedor de la superficie web.");
}

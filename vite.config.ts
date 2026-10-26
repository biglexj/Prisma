import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        audioToast: fileURLToPath(new URL("./audio-toast.html", import.meta.url)),
        // Entrada propia de la barra superior Synapse: así esa ventana no
        // comparte caché con el resto de ventanas de la aplicación.
        zone: fileURLToPath(new URL("./zone.html", import.meta.url)),
        // Superficie web de la composición del escritorio (capas 2 a 6). Viaja
        // en su propia ventana, colgada de la capa de fondo de Windows.
        compositor: fileURLToPath(new URL("./compositor.html", import.meta.url)),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 1421,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve: {
    alias: {
      "/icon": fileURLToPath(new URL("./icon", import.meta.url)),
    },
  },
});



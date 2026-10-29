import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/** Misma miniatura bajo demanda que la galería; el data URL permite exportar
 * el lienzo de arrastre con la imagen real, sin contaminarlo por otro origen. */
export function SynapseImage({ path }: { path: string }) {
  const [preview, setPreview] = useState<{ path: string; src: string }>();
  useEffect(() => {
    let disposed = false;
    void invoke<string | null>("visual_library_image_preview", { path }).then((src) => {
      if (!disposed && src) setPreview({ path, src });
    }).catch((error) => console.warn("[Synapse] No se pudo cargar la miniatura:", error));
    return () => { disposed = true; };
  }, [path]);
  return <img key={path} src={preview?.path === path ? preview.src : convertFileSrc(path)}
    alt="" draggable={false} />;
}

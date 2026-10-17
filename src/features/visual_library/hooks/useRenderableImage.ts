import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toSafeAssetUrl } from "../../../shared/mediaTree";

/** Decodificar directamente en Rust para formatos sin soporte web nativo (ELX, JXL)
 * o si el navegador falla con el asset local. */
export function useRenderableImage(path: string, revision: string | number) {
  const key = `${path}\n${revision}`;
  const isDirectDecodeNeeded = Boolean(path && /\.(elx|jxl)$/i.test(path));
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<{ key: string; src?: string; error?: string } | null>(null);

  const shouldDecode = Boolean(path && (isDirectDecodeNeeded || requestedKey === key));

  useEffect(() => {
    if (!shouldDecode) return;
    let disposed = false;
    void invoke<string>("visual_library_image_render", { path }).then(
      (src) => { if (!disposed) setDecoded({ key, src }); },
      (err) => {
        if (!disposed) {
          const msg = typeof err === "string" ? err : "No se pudo decodificar la imagen";
          setDecoded({ key, error: msg });
        }
      },
    );
    return () => { disposed = true; };
  }, [key, path, shouldDecode]);

  const current = decoded?.key === key ? decoded : null;
  const directUrl = isDirectDecodeNeeded
    ? ""
    : (path ? `${toSafeAssetUrl(path)}?v=${encodeURIComponent(revision)}` : "");

  return {
    src: current?.src ?? directUrl,
    error: current?.error ?? null,
    loading: Boolean(path && loadedKey !== key && !current?.error),
    onLoad: () => setLoadedKey(key),
    onError: () => {
      if (current?.src) setDecoded({ key, error: "No se pudo mostrar la imagen decodificada" });
      else setRequestedKey(key);
    },
  };
}

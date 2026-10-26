import { useEffect } from "react";
import { textFromTransfer, type DropAction, type ImportOptions } from "./model";

type ImportContent = (paths: string[], text: string | undefined, action: DropAction, options?: ImportOptions) => Promise<void>;

/** El foco de WebView2 puede estar en body, fuera del árbol de la estantería. */
export function useClipboardPaste(importContent: ImportContent, setError: (message: string) => void, getTargetSlot?: () => number | undefined, enabled = true) {
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (!enabled) return;
      const data = event.clipboardData;
      if (!data) return;
      event.preventDefault();
      const options = { clipboard: true, targetSlot: getTargetSlot?.() };
      const image = Array.from(data.files).find((file) => file.type.startsWith("image/"))
        ?? Array.from(data.items).find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (image) {
        const reader = new FileReader();
        reader.onload = () => void importContent([], String(reader.result), "temporary", options);
        reader.onerror = () => setError("No se pudo leer la imagen del portapapeles");
        reader.readAsDataURL(image);
      } else {
        const text = data.getData("text/plain") || textFromTransfer(data);
        if (text) void importContent([], text, "temporary", options);
        else setError("El portapapeles no contiene una imagen ni texto compatible");
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [importContent, setError, getTargetSlot, enabled]);
}

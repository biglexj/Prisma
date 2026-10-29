import { useEffect, useRef, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VaultItem } from "./model";

export const SYNAPSE_DRAG_TYPE = "application/x-prisma-synapse-item";
type Host = {
  postMessageWithAdditionalObjects(message: string, files: File[]): void;
};
function host(): Host | undefined { return (window as unknown as {chrome?: {webview?: Host}}).chrome?.webview; }

export function fillBrowserFileDrag(data: DataTransfer, file: File, id: string, preview: Element) {
  data.clearData();
  data.items.clear();
  if (!data.items.add(file)) throw new Error("El navegador no aceptó el archivo para arrastrarlo");
  data.setData(SYNAPSE_DRAG_TYPE, id);
  data.effectAllowed = "copy";
  data.setDragImage(preview, preview.clientWidth / 2, preview.clientHeight / 2);
}
export function sendBrowserFileDrop(files: File[], action: string, text?: string) {
  const bridge = host();
  if (!bridge) throw new Error("WebView2 no expuso el puente de archivos");
  bridge.postMessageWithAdditionalObjects(JSON.stringify({kind: "prisma-synapse-drop", action, text}), files);
}

/** File del disco bajo demanda; no leer los bytes ni convertir vídeos a base64. */
export function useBrowserFileDrag(items: VaultItem[], expanded: boolean, onError: (message: string) => void, setOutgoing: (active: boolean) => void) {
  const files = useRef(new Map<string, File>());
  const currentIds = useRef(new Set(items.map(item => item.id)));
  currentIds.current = new Set(items.map(item => item.id));
  const [, refresh] = useState(0);
  const active = useRef(false);
  const pending = useRef(new Map<string, {id: string; input: HTMLInputElement}>());
  useEffect(() => {
    const requests = pending.current;
    return () => {
      requests.forEach(request => request.input.remove()); requests.clear(); files.current.clear();
      active.current = false; setOutgoing(false);
    };
  }, [setOutgoing]);
  useEffect(() => {
    const ids = new Set(items.map(item => item.id));
    for (const id of files.current.keys()) if (!ids.has(id)) files.current.delete(id);
    for (const [key, request] of pending.current) if (!ids.has(request.id)) {
      request.input.remove(); pending.current.delete(key);
    }
    if (!expanded || !host()) return;
    for (const item of items) {
      if (!item.path || files.current.has(item.id) || [...pending.current.values()].some(request => request.id === item.id)) continue;
      const requestId = crypto.randomUUID();
      const input = document.createElement("input");
      input.type = "file"; input.hidden = true; input.id = `synapse-file-${requestId}`;
      document.body.append(input);
      pending.current.set(requestId, {id: item.id, input});
      void invoke("synapse_prepare_browser_drag", {id: item.id, requestId}).then(() => {
        if (!pending.current.has(requestId) || !currentIds.current.has(item.id)) return;
        const file = input.files?.[0];
        if (!file) throw new Error("WebView2 no entregó la referencia al archivo original");
        files.current.set(item.id, file); refresh(value => value + 1);
        if (import.meta.env.DEV) void invoke("vault_log", {message: "[arrastre navegador] Archivo preparado mediante entrada nativa"}).catch(() => {});
      }).catch(error => {
        if (pending.current.has(requestId)) onError(String(error));
      }).finally(() => {
        if (pending.current.get(requestId)?.input === input) pending.current.delete(requestId);
        input.remove();
      });
    }
  }, [items, expanded, onError]);
  return {
    ready: (id: string) => files.current.has(id),
    isOwn: (data: DataTransfer) => active.current || data.types.includes(SYNAPSE_DRAG_TYPE),
    start: (event: DragEvent<HTMLDivElement>, item: VaultItem) => {
      const file = files.current.get(item.id);
      if (!file || (event.target instanceof Element && event.target.closest("button"))) {
        event.preventDefault();
        if (!file) onError("El archivo aún se está preparando para arrastrarlo");
        return;
      }
      try {
        fillBrowserFileDrag(event.dataTransfer, file, item.id, event.currentTarget);
        active.current = true; setOutgoing(true); onError("");
        if (import.meta.env.DEV) void invoke("vault_log", {message: "[arrastre navegador] Inicio del gesto"}).catch(() => {});
      } catch (error) { event.preventDefault(); onError(String(error)); }
      event.stopPropagation();
    },
    end: (event: DragEvent<HTMLDivElement>) => {
      active.current = false; setOutgoing(false);
      if (import.meta.env.DEV) void invoke("vault_log", {message: `[arrastre navegador] Fin del gesto: ${event.dataTransfer.dropEffect}`}).catch(() => {});
    },
  };
}

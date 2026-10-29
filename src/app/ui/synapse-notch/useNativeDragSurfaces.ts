import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createNativeDragPreview } from "../../../shared/nativeDragPreview";
import type { VaultItem } from "./model";

/** La imagen conserva su render web; una superficie del host recibe el gesto. */
export function useNativeDragSurfaces(items: VaultItem[], visible: boolean, panel: RefObject<HTMLDivElement | null>, onError: (message: string) => void, setOutgoing: (active: boolean) => void) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  useEffect(() => {
    const handlers = [
      listen<boolean>("prisma:synapse-native-active", ({payload}) => {
        activeRef.current = payload; setActive(payload); setOutgoing(payload);
        if (payload) onError("");
      }),
      listen<string | null>("prisma:synapse-native-hover", ({payload}) => setHoveredId(payload)),
      listen<string>("prisma:synapse-native-error", ({payload}) => onError(payload)),
    ];
    return () => {
      handlers.forEach(handler => void handler.then(unlisten => unlisten()));
      void invoke("synapse_set_drag_surfaces", {surfaces: []}).catch(() => {});
      activeRef.current = false; setOutgoing(false);
    };
  }, [onError, setOutgoing]);

  useLayoutEffect(() => {
    if (active) return;
    let stopped = false;
    let frame = 0;
    let previous = "";
    const update = () => {
      if (stopped) return;
      const cards = visible ? Array.from(panel.current?.querySelectorAll<HTMLElement>("[data-vault-id]") ?? []) : [];
      const entries = cards.flatMap(card => {
        const item = items.find(item => item.id === card.dataset.vaultId);
        if (!item?.path) return [];
        const bounds = card.getBoundingClientRect();
        const controls = card.querySelector<HTMLElement>(".vault-card-actions")?.getBoundingClientRect();
        const width = Math.max(0, bounds.width - 2);
        const height = Math.max(0, (controls?.top ?? bounds.bottom) - bounds.top - 2);
        // Las animaciones pueden medir temporalmente fuera de la ventana.
        if (!width || !height || bounds.left < 0 || bounds.top < 0) return [];
        return [{item, card, x: Math.round(bounds.left + 1), y: Math.round(bounds.top + 1), width: Math.round(width), height: Math.round(height)}];
      });
      const signature = JSON.stringify(entries.map(({item,card,x,y,width,height}) => ({id:item.id,x,y,width,height,src:card.querySelector("img")?.src,loaded:card.querySelector("img")?.complete})));
      if (signature === previous) return;
      previous = signature;
      const surfaces = entries.map(({item,card,...bounds}) => ({...bounds,id:item.id,icon:createNativeDragPreview(item.path!,card,1,item.kind === "image" ? "square" : "auto")}));
      void invoke("synapse_set_drag_surfaces", {surfaces}).catch(error => {
        if (!stopped) {
          onError(String(error));
          if (import.meta.env.DEV) void invoke("vault_log", {message: `[superficie nativa] ${String(error)}`}).catch(() => {});
        }
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    const settled = setTimeout(schedule, 400);
    const element = panel.current;
    const observer = new ResizeObserver(schedule);
    if (element) { observer.observe(element); element.addEventListener("load", schedule, true); }
    return () => {
      stopped = true; cancelAnimationFrame(frame); clearTimeout(settled); observer.disconnect();
      element?.removeEventListener("load", schedule, true);
    };
  }, [items, visible, panel, onError, active]);
  return {hoveredId, isOwn: () => activeRef.current};
}

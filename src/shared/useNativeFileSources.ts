import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createNativeDragPreview, type PreviewShape } from "./nativeDragPreview";
import { intersectSurface, surfaceHoles, type SurfaceRect } from "./nativeFileSurfaceGeometry";
import { markHostFileDrag, DEFAULT_DRAG_ICON_BASE64 } from "./useNativeFileDrag";

const SOURCE = "[data-native-file-path]";
const CONTROLS = "button,input,select,textarea,a,[contenteditable='true'],[role='slider']";
interface SourceInput { id: string; kind: "click" | "dblclick" | "contextmenu" | "wheel" | "hwheel"; x: number; y: number; ctrl: boolean; shift: boolean; alt: boolean; delta: number }
const rect = (r: DOMRect): SurfaceRect => ({x: r.left, y: r.top, width: r.width, height: r.height});

/** Una gestión por ventana, con fuentes nativas solo para archivos visibles. */
export function useNativeFileSources() {
  useEffect(() => {
    if (!isTauri()) return;
    let stopped = false, active = false, sequence = 0, timer = 0, scrollTimer = 0;
    let revision = 0, previous = "", paths: string[] = [];
    const ids = new WeakMap<HTMLElement, string>();
    const elements = new Map<string, HTMLElement>();
    const icons = new Map<string, {key: string; png: string}>();
    const observed = new Set<HTMLElement>();
    const clearReady = () => elements.forEach(element => delete element.dataset.nativeFileReady);
    const send = async (surfaces: object[], signature: string) => {
      const current = ++revision;
      try {
        const ready = await invoke<string[]>("native_file_set_surfaces", {surfaces});
        if (stopped || current !== revision) return;
        clearReady();
        ready.forEach(id => { const element = elements.get(id); if (element) element.dataset.nativeFileReady = "true"; });
        previous = signature;
      } catch (error) {
        if (!stopped && current === revision) { previous = ""; clearReady(); console.warn("[Arrastre nativo]", error); }
      }
    };
    const schedule = () => {
      if (!stopped && !active && !timer && !scrollTimer) timer = window.setTimeout(() => { timer = 0; update(); }, 80);
    };
    const resize = new ResizeObserver(schedule);
    const update = () => {
      if (stopped || active) return;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(SOURCE));
      const alive = new Set(candidates);
      observed.forEach(element => { if (!alive.has(element)) { resize.unobserve(element); observed.delete(element); } });
      elements.forEach((element, id) => { if (!alive.has(element)) { elements.delete(id); icons.delete(id); } });
      candidates.forEach(element => { if (!observed.has(element)) { observed.add(element); resize.observe(element); } });
      // Leer geometría en bloque y generar las miniaturas después.
      const controls = Array.from(document.querySelectorAll<HTMLElement>(CONTROLS)).map(element => ({element, bounds: rect(element.getBoundingClientRect())}));
      const entries = candidates.flatMap(element => {
        const path = element.dataset.nativeFilePath;
        if (!path || !element.getClientRects().length || getComputedStyle(element).visibility === "hidden") return [];
        let bounds = intersectSurface(rect(element.getBoundingClientRect()), {x:0, y:0, width:innerWidth, height:innerHeight});
        for (let parent = element.parentElement; bounds && parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) bounds = intersectSurface(bounds, rect(parent.getBoundingClientRect()));
        }
        if (!bounds || bounds.width < 4 || bounds.height < 4) return [];
        const top = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        if (!top || !element.contains(top)) return [];
        let id = ids.get(element);
        if (!id) { id = `file-${++sequence}`; ids.set(element, id); }
        elements.set(id, element);
        const holes = surfaceHoles(bounds, controls.filter(control => control.element !== element && !control.element.contains(element)).map(control => control.bounds));
        if (holes.length > 32) return [];
        return [{id, element, path, ...bounds, holes}];
      }).slice(0, 96);
      const signature = JSON.stringify(entries.map(({element,...entry}) => ({...entry, image:element.querySelector("img")?.src, loaded:element.querySelector("img")?.complete})));
      if (signature === previous) return;
      const surfaces = entries.map(({element,...entry}) => {
        const selector = element.dataset.nativeFilePreview;
        const preview = selector ? document.querySelector(selector) : element;
        const image = preview instanceof HTMLImageElement ? preview : preview?.querySelector("img");
        const shape = (element.dataset.nativeFileShape ?? "auto") as PreviewShape;
        const key = `${entry.path}:${image?.src}:${image?.complete}:${shape}`;
        let cached = icons.get(entry.id);
        if (!cached || cached.key !== key) {
          const png = createNativeDragPreview(entry.path, preview, 1, shape) ?? DEFAULT_DRAG_ICON_BASE64;
          cached = {key, png};
          icons.set(entry.id, cached);
        }
        return {...entry, icon: cached.png};
      });
      previous = signature;
      void send(surfaces, signature);
    };
    const scroll = () => {
      if (active || stopped) return;
      window.clearTimeout(timer); timer = 0;
      if (!scrollTimer) { previous = ""; clearReady(); void send([], ""); }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => { scrollTimer = 0; schedule(); }, 140);
    };
    const focus = () => { previous = ""; schedule(); };
    const input = ({payload}: {payload: SourceInput}) => {
      const element = elements.get(payload.id);
      if (!element?.isConnected) return;
      const options = {bubbles:true, cancelable:true, clientX:payload.x, clientY:payload.y, ctrlKey:payload.ctrl, shiftKey:payload.shift, altKey:payload.alt};
      if (payload.kind === "wheel" || payload.kind === "hwheel") {
        const delta = (payload.kind === "hwheel" ? payload.delta : -payload.delta) / 120 * 72;
        const horizontal = payload.kind === "hwheel" || payload.shift;
        const wheel = new WheelEvent("wheel", {...options, deltaY:horizontal ? 0 : delta, deltaX:horizontal ? delta : 0});
        if (!element.dispatchEvent(wheel) || payload.ctrl) return;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          const canScroll = horizontal ? node.scrollWidth > node.clientWidth && /(auto|scroll)/.test(style.overflowX) : node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(style.overflowY);
          if (canScroll) { node.scrollBy(horizontal ? {left:delta} : {top:delta}); scroll(); break; }
        }
      } else {
        element.focus({preventScroll:true});
        element.dispatchEvent(new MouseEvent(payload.kind, {...options, button:payload.kind === "contextmenu" ? 2 : 0, detail:payload.kind === "dblclick" ? 2 : 1}));
        schedule();
      }
    };
    const subscriptions = [
      listen<string[]>("prisma:native-file-source-paths", ({payload}) => { paths = payload; markHostFileDrag(paths, true); }),
      listen<boolean>("prisma:native-file-source-active", ({payload}) => { active = payload; markHostFileDrag(paths, payload); if (!payload) { previous = ""; schedule(); } }),
      listen<SourceInput>("prisma:native-file-source-input", input),
      listen<string>("prisma:native-file-source-error", ({payload}) => console.warn("[Arrastre nativo]", payload)),
    ];
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:["data-native-file-path", "src", "class", "hidden"]});
    window.addEventListener("resize", scroll);
    window.addEventListener("focus", focus);
    window.addEventListener("scroll", scroll, true);
    document.addEventListener("load", schedule, true);
    schedule();
    return () => {
      stopped = true; revision++;
      window.clearTimeout(timer); window.clearTimeout(scrollTimer);
      clearReady(); mutations.disconnect(); resize.disconnect();
      window.removeEventListener("resize", scroll); window.removeEventListener("scroll", scroll, true); document.removeEventListener("load", schedule, true);
      window.removeEventListener("focus", focus);
      subscriptions.forEach(subscription => void subscription.then(unlisten => unlisten()));
      void invoke("native_file_set_surfaces", {surfaces:[]}).catch(() => {});
    };
  }, []);
}

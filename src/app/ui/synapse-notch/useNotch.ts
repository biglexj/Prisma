import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { VAULT_CHANGED_EVENT, VAULT_OPEN_EVENT, actionAt, type DropAction, type ImportedItem, type ImportOptions, type VaultDrag, type VaultItem } from "./model";

/** Alto de la franja que siempre se ve (la línea de color). */
const STRIP_HEIGHT = 3;
/** Alto mínimo de la barra mientras se arrastra: zona cómoda para soltar. */
const DRAG_MIN_HEIGHT = 132;

export function useNotch() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [action, setAction] = useState<DropAction>("temporary");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  const [surfaceColor, setSurfaceColor] = useState<[number, number, number, number]>();
  const openRef = useRef(false);
  const busyRef = useRef(false);
  const draggingRef = useRef(false);
  const holdUntil = useRef(0);
  const locked = useRef(false);
  const waitForLeave = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Referencia al panel: su alto decide el alto de la ventana. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const width = Math.min(600, window.screen.width - 16);

  const show = useCallback(() => {
    clearTimeout(closeTimer.current);
    holdUntil.current = Date.now() + 1000;
    if (openRef.current) return;
    openRef.current = true;
    // Si se reabre durante el cierre, el tamaño nativo sigue disponible.
    if (panelRef.current) setRevealed(true);
    setExpanded(true);
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    if (!openRef.current) return;
    clearTimeout(closeTimer.current);
    waitForLeave.current = true;
    openRef.current = false;
    setOpen(false);
    setRevealed(false);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = setTimeout(() => setExpanded(false), reduced ? 0 : 220);
  }, []);

  // Medir el contenido con su ancho final antes de pedir un tamaño nativo.
  // El panel mantiene ese ancho incluso mientras la ventana sigue en 100×3:
  // así las tarjetas nunca se miden apiladas en la franja de reposo.
  useLayoutEffect(() => {
    let disposed = false;
    let previousSize = "";
    let focusOnResize = expanded && !dragging;
    const resize = (nextWidth: number, nextHeight: number) => {
      if (disposed) return;
      const signature = `${nextWidth}:${nextHeight}`;
      if (signature === previousSize) return;
      previousSize = signature;
      void invoke("system_drop_zone_set_size", { width: nextWidth, height: nextHeight, background: surfaceColor, focus: focusOnResize })
        .then(() => {
          // No gastar la entrada dentro de los 100×3 px de reposo: arrancar
          // cuando el backend ya haya aplicado el tamaño definitivo.
          if (!disposed && expanded && openRef.current) setRevealed(true);
        })
        .catch((err) => { if (!disposed) setError(String(err)); });
      focusOnResize = false;
    };
    if (!expanded) {
      resize(100, STRIP_HEIGHT);
      return () => { disposed = true; };
    }
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      // offsetHeight no incluye la escala de la animación de entrada.
      const height = panel.offsetHeight;
      resize(width, Math.max(height, dragging ? DRAG_MIN_HEIGHT : 0) + STRIP_HEIGHT);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => { disposed = true; observer.disconnect(); };
  }, [expanded, width, dragging, surfaceColor]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const inside = await invoke<boolean>("drop_zone_pointer_inside", { activationArea: !openRef.current });
        if (cancelled) return;
        if (!inside) waitForLeave.current = false;
        if (inside && !waitForLeave.current) {
          if (!openRef.current) show();
          holdUntil.current = Date.now() + 650;
        } else if (openRef.current && !busyRef.current && !draggingRef.current && !locked.current && Date.now() > holdUntil.current) hide();
      } finally { inFlight = false; }
    };
    const timer = setInterval(() => void check().catch(() => undefined), 180);
    return () => { cancelled = true; clearInterval(timer); clearTimeout(closeTimer.current); };
  }, [show, hide]);

  useEffect(() => { locked.current = pendingPaths.length > 0; }, [pendingPaths.length]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (attempts: number) => {
      try {
        const list = await invoke<VaultItem[]>("vault_list");
        if (!stopped) setItems(list);
      } catch (err) {
        if (!stopped && attempts > 0) timer = setTimeout(() => void refresh(attempts - 1), 400);
        else if (!stopped) setError(String(err));
      }
    };
    void refresh(12);
    const changed = listen<VaultItem[]>(VAULT_CHANGED_EVENT, ({ payload }) => setItems(payload));
    const opened = listen(VAULT_OPEN_EVENT, () => {
      if (openRef.current) hide();
      else { show(); holdUntil.current = Date.now() + 30000; }
    });
    return () => { stopped = true; clearTimeout(timer); void changed.then((fn) => fn()); void opened.then((fn) => fn()); };
  }, [show, hide]);

  const setDrag = useCallback((active: boolean) => {
    draggingRef.current = active;
    setDragging(active);
    void invoke("system_drop_zone_set_active", { active }).catch(() => undefined);
    if (active) show();
    else holdUntil.current = Date.now() + 1000;
  }, [show]);

  const importContent = useCallback(async (paths: string[], text: string | undefined, selected: DropAction, options?: ImportOptions) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("Guardando…");
    show();
    const imported: string[] = [];
    try {
      for (const path of paths.length ? paths : [null]) {
        const result = await invoke<ImportedItem>("vault_import", { path, text: path ? null : text, pinned: selected === "pin", clipboard: options?.clipboard ?? false, targetSlot: options?.targetSlot });
        setItems(result.items);
        imported.push(result.path);
      }
      setMessage(selected === "pin" ? "Fijado" : "Prisma Synapse");
    } catch (err) { setError(String(err)); setMessage(""); }
    finally {
      if (selected === "phone" && imported.length) setPendingPaths(imported);
      busyRef.current = false;
      setBusy(false);
      setDrag(false);
    }
  }, [show, setDrag]);

  useEffect(() => {
    const handlers = [
      listen<VaultDrag>("prisma:vault-drag-enter", () => {
        setDrag(true);
        // La ventana aún conserva los 100 px de reposo: el destino inicial es temporal.
        setAction("temporary");
      }),
      listen<VaultDrag>("prisma:vault-drag-over", ({ payload }) => {
        // Mientras arrastras la barra solo muestra los tres destinos: el
        // destino depende de la posición horizontal, no de la vertical.
        setAction(actionAt(payload.position.x, payload.position.y, width, window.devicePixelRatio, true));
      }),
      listen("prisma:vault-drag-leave", () => setDrag(false)),
      listen<VaultDrag>("prisma:vault-drag-drop", ({ payload }) => {
        const selected = actionAt(payload.position.x, payload.position.y, width, window.devicePixelRatio, true);
        setDrag(false);
        void importContent(payload.paths, payload.text ?? undefined, selected);
      }),
    ];
    return () => { handlers.forEach((handler) => void handler.then((fn) => fn())); };
  }, [width, setDrag, importContent]);

  useEffect(() => {
    const apply = () => {
      const mode = localStorage.getItem("prisma_theme") ?? "system";
      document.documentElement.classList.toggle("dark", mode === "dark" || mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = mode;
      for (const [key, attribute] of [["prisma_accent", "data-accent"], ["prisma_bg_variant", "data-bg"]]) {
        const value = localStorage.getItem(key);
        if (value) document.documentElement.setAttribute(attribute, value);
      }
      // Resolver el color real del tema, incluidos color-mix y presets, para
      // igualar el fondo nativo al del documento antes de abrir la barra.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = getComputedStyle(document.documentElement).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        setSurfaceColor((previous) => previous?.[0] === red && previous[1] === green && previous[2] === blue
          ? previous : [red, green, blue, 255]);
      }
    };
    apply();
    window.addEventListener("storage", apply);
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => { window.removeEventListener("storage", apply); media.removeEventListener("change", apply); };
  }, []);

  return { items, setItems, open, expanded, revealed, show, hide, dragging, setDrag, action, setAction, message, setMessage, error, setError, busy, pendingPaths, setPendingPaths, importContent, panelRef, width };
}

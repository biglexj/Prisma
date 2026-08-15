import { useLayoutEffect, useEffect, useRef } from "react";

// Global session memory that preserves scroll positions across component remounts and navigation
const sessionScrollMap = new Map<string, number>();

export function saveSessionScroll(key: string, scrollTop: number): void {
  sessionScrollMap.set(key, Math.max(0, scrollTop));
}

export function getSessionScroll(key: string): number {
  return sessionScrollMap.get(key) ?? 0;
}

export function clearSessionScroll(key: string): void {
  sessionScrollMap.delete(key);
}

/**
 * Hook to preserve and restore scroll position for `.studio-content` or a custom container.
 * 
 * @param key Unique key for this view state (e.g. `view:home`, `view:music:folders:rock`, `view:images:timeline`)
 * @param ready Optional flag indicating whether data has loaded so we can accurately restore scroll
 * @param selector CSS selector for the scroll container (defaults to `.studio-content`)
 */
export function useScrollRestoration(
  key: string,
  ready = true,
  selector = ".studio-content"
): void {
  const lastKeyRef = useRef(key);
  lastKeyRef.current = key;

  // On mount or when key/ready changes, restore saved scroll position
  useLayoutEffect(() => {
    const container = document.querySelector(selector) as HTMLElement | null;
    if (!container || !ready) return;

    const savedScroll = sessionScrollMap.get(key) ?? 0;

    const applyScroll = () => {
      const currentContainer = document.querySelector(selector) as HTMLElement | null;
      if (!currentContainer) return;
      currentContainer.scrollTop = savedScroll;
    };

    // 1. Inmediato en el ciclo de layout de React
    applyScroll();

    // 2. En el siguiente cuadro de animación (después de que el DOM y layouts se estabilicen)
    const rafId = requestAnimationFrame(() => {
      applyScroll();
    });

    // 3. Pequeño timeout de seguridad para contenidos que calculan alturas de forma asíncrona
    const timerId = window.setTimeout(() => {
      applyScroll();
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [key, ready, selector]);

  // Listen for scroll events to continuously save the latest scroll position
  useEffect(() => {
    const container = document.querySelector(selector) as HTMLElement | null;
    if (!container) return;

    const handleScroll = () => {
      if (lastKeyRef.current) {
        sessionScrollMap.set(lastKeyRef.current, container.scrollTop);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      // Guardar posición al desmontar o cambiar de clave
      if (lastKeyRef.current) {
        sessionScrollMap.set(lastKeyRef.current, container.scrollTop);
      }
      container.removeEventListener("scroll", handleScroll);
    };
  }, [key, selector]);
}

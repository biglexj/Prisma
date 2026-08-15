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
    if (savedScroll <= 0) return;

    let attempts = 0;
    const maxAttempts = 12;

    const tryRestore = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      el.scrollTop = savedScroll;
      // Si el DOM aún se está pintando y la altura es menor que savedScroll, reintentar en el siguiente frame
      if (el.scrollTop < savedScroll && attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryRestore);
      }
    };

    // 1. Inmediato en el ciclo de layout sincrónico de React
    tryRestore();

    // 2. En el siguiente cuadro de animación
    const rafId = requestAnimationFrame(tryRestore);

    // 3. Reintentos temporizados para asegurar que imágenes, grids y layouts asíncronos estabilicen su altura
    const t1 = window.setTimeout(tryRestore, 40);
    const t2 = window.setTimeout(tryRestore, 120);
    const t3 = window.setTimeout(tryRestore, 280);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
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
      // Guardar posición al desmontar o cambiar de clave SOLO si es > 0,
      // evitando que reseteos artificiales del DOM durante el desmontaje borren el scroll real
      if (lastKeyRef.current && container.scrollTop > 0) {
        sessionScrollMap.set(lastKeyRef.current, container.scrollTop);
      }
      container.removeEventListener("scroll", handleScroll);
    };
  }, [key, selector]);
}

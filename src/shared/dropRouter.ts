/**
 * Coordinación entre las zonas de recepción de archivos y el manejador global
 * de arrastre. Permite que una zona concreta reclame un soltado antes de que
 * el manejador global lo intercepte (por ejemplo, para enviarlo a Super Galería
 * en vez de añadirlo a una biblioteca).
 */

const CLAIM_TIMEOUT_MS = 2500;

let armed = false;
let armedAt = 0;
const claimedPaths = new Map<string, number>();

function normalizePath(path: string): string {
  return path.replace(/\//g, "\\").toLowerCase();
}

/** Marca que el puntero está sobre una zona de recepción. */
export function armDropZone(): void {
  armed = true;
  armedAt = Date.now();
}

export function disarmDropZone(): void {
  armed = false;
}

/** Indica si hay una zona de recepción activa bajo el puntero. */
export function isDropZoneArmed(): boolean {
  if (!armed) return false;
  if (Date.now() - armedAt > CLAIM_TIMEOUT_MS) {
    armed = false;
    return false;
  }
  return true;
}

/** Reserva rutas ya atendidas por una zona para que el manejador global las ignore. */
export function claimDropPaths(paths: string[]): void {
  const now = Date.now();
  for (const path of paths) {
    claimedPaths.set(normalizePath(path), now);
  }
}

/** Indica si esas rutas ya fueron atendidas por una zona de recepción. */
export function isClaimedDrop(paths: string[]): boolean {
  if (!paths || paths.length === 0) return false;
  const now = Date.now();
  return paths.some((path) => {
    const key = normalizePath(path);
    const stamp = claimedPaths.get(key);
    if (stamp === undefined) return false;
    if (now - stamp > CLAIM_TIMEOUT_MS) {
      claimedPaths.delete(key);
      return false;
    }
    return true;
  });
}

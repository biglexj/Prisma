import type { RenamerFileItem } from "./types";

export function selectionPathKey(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

/** Conservar el orden de las tandas y las exclusiones manuales; añadir solo rutas nuevas. */
export function mergeSourceSelection(
  current: RenamerFileItem[], incoming: RenamerFileItem[], selected: Set<string>, append: boolean,
): { items: RenamerFileItem[]; selected: Set<string> } {
  const items = append ? [...current] : [];
  const selectedPaths = append ? new Set(selected) : new Set<string>();
  const seen = new Set(items.map((item) => selectionPathKey(item.path)));
  for (const item of incoming) {
    const key = selectionPathKey(item.path);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    selectedPaths.add(item.path);
  }
  return { items, selected: selectedPaths };
}

export function orderSourceSelection(items: RenamerFileItem[], paths: string[]): RenamerFileItem[] {
  const order = new Map(paths.map((path, index) => [selectionPathKey(path), index]));
  return [...items].sort((a, b) =>
    (order.get(selectionPathKey(a.path)) ?? paths.length) -
    (order.get(selectionPathKey(b.path)) ?? paths.length));
}

/** Serializar tandas y descartar la segunda notificación del mismo gesto por otro canal. */
export function createSourceDropQueue() {
  let tail = Promise.resolve();
  let last: { signature: string; channel: string; time: number } | null = null;
  return (paths: string[], channel: "native" | "webview", work: () => Promise<void>, time = Date.now()) => {
    const signature = JSON.stringify(paths.map(selectionPathKey).sort());
    if (last && last.channel !== channel && last.signature === signature && time - last.time < 500) return tail;
    last = { signature, channel, time };
    tail = tail.catch(() => {}).then(work);
    return tail;
  };
}

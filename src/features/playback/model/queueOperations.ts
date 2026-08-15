import {
  type MusicQueue,
  type MusicQueueItem,
  type QueueMoveResult,
  type QueueRemovalResult,
  stableMediaId,
} from "./queue";

/**
 * Restaura el índice activo priorizando la ruta/identidad estable de la canción.
 * Evita saltos accidentales al índice 0 si la lista cambió de orden.
 */
export function resolveRestoredItemIndex(
  queue: MusicQueue | null | undefined,
  savedPath: string | null | undefined,
  fallbackIndex: number,
): number {
  if (!queue || queue.items.length === 0) return 0;
  if (savedPath && savedPath.trim().length > 0) {
    const targetId = stableMediaId({ path: savedPath });
    const found = queue.items.findIndex((item) => stableMediaId(item) === targetId);
    if (found >= 0) return found;
  }
  return Math.max(0, Math.min(fallbackIndex, queue.items.length - 1));
}

/**
 * Mueve un elemento en la cola sin perder el orden relativo de los demás.
 */
export function moveItemInQueue(
  items: MusicQueueItem[],
  fromIndex: number,
  toIndex: number,
): MusicQueueItem[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Reordena una canción y recalcula el puntero de reproducción activo para que
 * continúe apuntando a la misma canción que está sonando.
 */
export function moveItemKeepingCurrent(
  items: MusicQueueItem[],
  currentIndex: number,
  fromIndex: number,
  toIndex: number,
): QueueMoveResult {
  const safeCurrent = Math.max(0, Math.min(currentIndex, Math.max(0, items.length - 1)));
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return { items, currentIndex: safeCurrent };
  }

  const updatedItems = moveItemInQueue(items, fromIndex, toIndex);
  let updatedIndex = safeCurrent;

  if (safeCurrent === fromIndex) {
    updatedIndex = toIndex;
  } else if (fromIndex < safeCurrent && toIndex >= safeCurrent) {
    updatedIndex = safeCurrent - 1;
  } else if (fromIndex > safeCurrent && toIndex <= safeCurrent) {
    updatedIndex = safeCurrent + 1;
  }

  return {
    items: updatedItems,
    currentIndex: Math.max(0, Math.min(updatedIndex, updatedItems.length - 1)),
  };
}

/**
 * Mueve una cola completa dentro de la lista de colas.
 */
export function moveQueueInList(
  queues: MusicQueue[],
  fromIndex: number,
  toIndex: number,
): MusicQueue[] {
  if (
    fromIndex < 0 ||
    fromIndex >= queues.length ||
    toIndex < 0 ||
    toIndex >= queues.length ||
    fromIndex === toIndex
  ) {
    return queues;
  }
  const result = [...queues];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Elimina una canción de la cola y preserva el puntero sobre la canción que estaba sonando.
 */
export function removeItemFromQueue(
  items: MusicQueueItem[],
  currentIndex: number,
  removeIndex: number,
): QueueRemovalResult {
  if (removeIndex < 0 || removeIndex >= items.length) {
    return {
      items,
      currentIndex: Math.max(0, Math.min(currentIndex, Math.max(0, items.length - 1))),
    };
  }

  const updatedItems = items.filter((_, idx) => idx !== removeIndex);
  if (updatedItems.length === 0) {
    return { items: [], currentIndex: 0 };
  }

  let updatedIndex = currentIndex;
  if (removeIndex < currentIndex) {
    updatedIndex = currentIndex - 1;
  } else if (removeIndex === currentIndex) {
    updatedIndex = Math.min(currentIndex, updatedItems.length - 1);
  }

  return {
    items: updatedItems,
    currentIndex: Math.max(0, Math.min(updatedIndex, updatedItems.length - 1)),
  };
}

/**
 * Sitúa la canción actual al inicio (índice 0) y rota circularmente las demás.
 */
export function rewindQueue(items: MusicQueueItem[], currentIndex: number): MusicQueueItem[] {
  if (items.length <= 1) return items;
  const safeIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
  return [...items.slice(safeIndex), ...items.slice(0, safeIndex)];
}

/**
 * Coloca la canción actual primero y mezcla únicamente las canciones restantes.
 * Si el orden resultante fuese idéntico, lo rota para garantizar variación.
 */
export function shuffleQueueKeepingCurrentFirst(
  items: MusicQueueItem[],
  currentIndex: number,
): MusicQueueItem[] {
  if (items.length <= 1) return items;
  const safeIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
  const currentItem = items[safeIndex];
  const remaining = items.filter((_, idx) => idx !== safeIndex);

  // Fisher-Yates shuffle
  const shuffled = [...remaining];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (
    shuffled.length > 1 &&
    shuffled.every((item, idx) => item.path === remaining[idx]?.path)
  ) {
    const [first, ...rest] = shuffled;
    return [currentItem, ...rest, first];
  }

  return [currentItem, ...shuffled];
}

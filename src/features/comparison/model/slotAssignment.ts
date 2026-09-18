import type { ComparisonImageSlot, ComparisonMode } from "./types";
import { createVisualItemFromPath, isSupportedMediaPath, getMediaType } from "./types";

export interface SlotAssignmentResult {
  slots: ComparisonImageSlot[];
  slotAId?: string;
  slotBId?: string;
  nextMode?: ComparisonMode;
}

/**
 * Calcula la asignación inteligente de slots al arrastrar archivos sueltos o lotes de fotos/vídeos/música.
 * Aplica restricción por tipo (imagen, vídeo, audio) para evitar colisiones y conflictos de reproducción.
 */
export function assignDroppedPathsToSlots(
  prev: ComparisonImageSlot[],
  filePaths: string[],
  targetZone?: "slot-a" | "slot-b" | null,
  lastHoveredZone?: "slot-a" | "slot-b" | null,
): SlotAssignmentResult {
  let validPaths = filePaths.filter(isSupportedMediaPath);
  if (validPaths.length === 0) {
    return { slots: prev };
  }

  // Restricción estricta: si ya hay elementos cargados, solo admitir archivos del mismo tipo.
  // Si está vacío, el primer elemento del lote define el tipo exclusivo.
  const baseType = prev.length > 0
    ? getMediaType(prev[0].item.path)
    : getMediaType(validPaths[0]);

  if (baseType) {
    validPaths = validPaths.filter((p) => getMediaType(p) === baseType);
  }

  if (validPaths.length === 0) {
    return { slots: prev };
  }

  // 1. Si el comparador está completamente vacío:
  if (prev.length === 0) {
    if (validPaths.length === 1) {
      const slot0: ComparisonImageSlot = {
        id: "slot-0",
        item: createVisualItemFromPath(validPaths[0]),
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
      return { slots: [slot0], slotAId: "slot-0" };
    }

    // 2 o más archivos: uno al Slot A y otro al Slot B (Lado a Lado)
    const slotAItem: ComparisonImageSlot = {
      id: "slot-0",
      item: createVisualItemFromPath(validPaths[0]),
      zoom: 1,
      pan: { x: 0, y: 0 },
    };
    const slotBItem: ComparisonImageSlot = {
      id: "slot-1",
      item: createVisualItemFromPath(validPaths[1]),
      zoom: 1,
      pan: { x: 0, y: 0 },
    };

    const extraSlots: ComparisonImageSlot[] = validPaths.slice(2, 6).map((p, idx) => ({
      id: `slot-extra-${Date.now()}-${idx}`,
      item: createVisualItemFromPath(p),
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));

    return {
      slots: [slotAItem, slotBItem, ...extraSlots],
      slotAId: "slot-0",
      slotBId: "slot-1",
      nextMode: validPaths.length > 2 ? "grid" : "split",
    };
  }

  // 2. Si ya hay 1 solo elemento en la comparativa:
  if (prev.length === 1) {
    if (targetZone === "slot-a") {
      const updatedSlotA: ComparisonImageSlot = {
        ...prev[0],
        item: createVisualItemFromPath(validPaths[0]),
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
      if (validPaths.length > 1) {
        const slotBItem: ComparisonImageSlot = {
          id: "slot-1",
          item: createVisualItemFromPath(validPaths[1]),
          zoom: 1,
          pan: { x: 0, y: 0 },
        };
        return { slots: [updatedSlotA, slotBItem], slotBId: "slot-1" };
      }
      return { slots: [updatedSlotA] };
    }

    // Si soltó en Slot B o en el lienzo general:
    const slotBItem: ComparisonImageSlot = {
      id: "slot-1",
      item: createVisualItemFromPath(validPaths[0]),
      zoom: 1,
      pan: { x: 0, y: 0 },
    };

    const extraSlots: ComparisonImageSlot[] = validPaths.slice(1, 5).map((p, idx) => ({
      id: `slot-extra-${Date.now()}-${idx}`,
      item: createVisualItemFromPath(p),
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));

    return {
      slots: [...prev, slotBItem, ...extraSlots],
      slotBId: "slot-1",
      nextMode: validPaths.length > 1 ? "grid" : undefined,
    };
  }

  // 3. Si ya hay 2 o más elementos:
  if (targetZone === "slot-a") {
    const slotAId = prev[0]?.id ?? "slot-0";
    const updated = prev.map((s) =>
      s.id === slotAId
        ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
        : s,
    );
    if (validPaths.length > 1 && prev.length > 1) {
      const slotBId = prev[1]?.id ?? "slot-1";
      return {
        slots: updated.map((s) =>
          s.id === slotBId
            ? { ...s, item: createVisualItemFromPath(validPaths[1]), zoom: 1, pan: { x: 0, y: 0 } }
            : s,
        ),
      };
    }
    return { slots: updated };
  }

  if (targetZone === "slot-b") {
    const slotBId = prev.length > 1 ? prev[1].id : "slot-1";
    return {
      slots: prev.map((s) =>
        s.id === slotBId
          ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
          : s,
      ),
    };
  }

  // Soltado general: si ya hay 2 slots, reemplazar el slot bajo el cursor
  if (prev.length >= 2) {
    const zone = lastHoveredZone;
    if (zone === "slot-a") {
      const slotAId = prev[0]?.id ?? "slot-0";
      return {
        slots: prev.map((s) =>
          s.id === slotAId
            ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
            : s,
        ),
      };
    }
    if (zone === "slot-b") {
      const slotBId = prev[1]?.id ?? "slot-1";
      return {
        slots: prev.map((s) =>
          s.id === slotBId
            ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
            : s,
        ),
      };
    }

    // Sin hover claro → añadir si hay espacio (hasta 6)
    const canAdd = Math.max(0, 6 - prev.length);
    const toAdd = validPaths.slice(0, canAdd);
    if (toAdd.length === 0) return { slots: prev };

    const newSlots: ComparisonImageSlot[] = toAdd.map((p, idx) => ({
      id: `slot-${Date.now()}-${idx}`,
      item: createVisualItemFromPath(p),
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    return { slots: [...prev, ...newSlots], nextMode: "grid" };
  }

  // Soltado general / añadir imágenes (hasta 6) — solo cuando < 2 slots
  const currentCount = prev.length;
  const canAdd = Math.max(0, 6 - currentCount);
  const toAdd = validPaths.slice(0, canAdd);
  if (toAdd.length === 0) return { slots: prev };

  const newSlots: ComparisonImageSlot[] = toAdd.map((p, idx) => ({
    id: `slot-${Date.now()}-${idx}`,
    item: createVisualItemFromPath(p),
    zoom: 1,
    pan: { x: 0, y: 0 },
  }));

  return { slots: [...prev, ...newSlots], nextMode: "grid" };
}

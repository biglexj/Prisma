import type { ClipColor, TakeStatus } from "./types";

export interface ClipColorDef {
  id: ClipColor;
  label: string;
  hex: string;
}

export const DAVINCI_CLIP_COLORS: ClipColorDef[] = [
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "apricot", label: "Apricot", hex: "#fb923c" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "lime", label: "Lime", hex: "#84cc16" },
  { id: "olive", label: "Olive", hex: "#65a30d" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "purple", label: "Purple", hex: "#8b5cf6" },
  { id: "violet", label: "Violet", hex: "#a855f7" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "tan", label: "Tan", hex: "#d4a373" },
  { id: "beige", label: "Beige", hex: "#e2d4c0" },
  { id: "brown", label: "Brown", hex: "#8d5b4c" },
  { id: "chocolate", label: "Chocolate", hex: "#5c3a21" },
];

export interface TakeStatusDef {
  id: TakeStatus;
  label: string;
  badge: string;
  color: string;
  shortcut: string;
  iconName: string;
}

export const TAKE_STATUS_DEFS: Record<TakeStatus, TakeStatusDef> = {
  good_take: {
    id: "good_take",
    label: "Buena Toma",
    badge: "GOOD TAKE",
    color: "#22c55e",
    shortcut: "1",
    iconName: "check-circle",
  },
  reject: {
    id: "reject",
    label: "Descarte",
    badge: "DESCARTE",
    color: "#ef4444",
    shortcut: "2",
    iconName: "x-circle",
  },
  b_roll: {
    id: "b_roll",
    label: "B-Roll",
    badge: "B-ROLL",
    color: "#f97316",
    shortcut: "3",
    iconName: "film",
  },
  pending: {
    id: "pending",
    label: "Sin Marcar",
    badge: "PENDIENTE",
    color: "#94a3b8",
    shortcut: "0",
    iconName: "circle",
  },
};

export function getClipColorHex(color?: ClipColor | null): string | undefined {
  if (!color || color === "none") return undefined;
  return DAVINCI_CLIP_COLORS.find((c) => c.id === color)?.hex;
}

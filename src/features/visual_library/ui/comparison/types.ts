import type { VisualLibraryItem } from "../../model/types";

export type ComparisonMode = "split" | "curtain" | "grid" | "flick";

export interface ComparisonImageSlot {
  id: string;
  item: VisualLibraryItem;
  zoom: number;
  pan: { x: number; y: number };
  width?: number;
  height?: number;
}

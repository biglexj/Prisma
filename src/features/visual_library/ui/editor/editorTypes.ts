export type EditorTab = "transform" | "filters" | "adjust" | "draw";

export type AspectRatioOption = "free" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

export type PhotoFilter =
  | "none"
  | "struck"
  | "clarendon"
  | "mars"
  | "rise"
  | "abril"
  | "vintage"
  | "sepia"
  | "grayscale"
  | "invert";

export interface FilterDefinition {
  id: PhotoFilter;
  label: string;
  cssFilter: (intensity: number) => string;
}

export interface EditorAdjustments {
  brightness: number; // -100 to 100 (default 0)
  contrast: number; // -100 to 100 (default 0)
  saturation: number; // -100 to 100 (default 0)
  blur: number; // 0 to 20 (default 0)
}

export interface DoodlePoint {
  x: number;
  y: number;
}

export interface DoodleStroke {
  points: DoodlePoint[];
  color: string;
  width: number;
}

export interface CropRect {
  x: number; // 0..1 normalizado respecto a imagen rotada
  y: number; // 0..1 normalizado respecto a imagen rotada
  width: number; // 0..1 normalizado
  height: number; // 0..1 normalizado
}

export interface ImageEditorSaveOptions {
  overwrite: boolean;
  customFileName: string;
}

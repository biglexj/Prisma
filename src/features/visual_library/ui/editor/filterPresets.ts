import type { FilterDefinition, PhotoFilter } from "./editorTypes";

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    id: "none",
    label: "Original",
    cssFilter: () => "none",
  },
  {
    id: "struck",
    label: "Struck",
    cssFilter: (i) =>
      `contrast(${1 + 0.25 * i}) saturate(${1 + 0.3 * i}) brightness(${1 + 0.05 * i})`,
  },
  {
    id: "clarendon",
    label: "Clarendon",
    cssFilter: (i) =>
      `contrast(${1 + 0.3 * i}) saturate(${1 + 0.4 * i}) brightness(${1 + 0.08 * i})`,
  },
  {
    id: "mars",
    label: "Mars",
    cssFilter: (i) =>
      `sepia(${0.25 * i}) saturate(${1 + 0.45 * i}) hue-rotate(${-15 * i}deg) contrast(${1 + 0.2 * i})`,
  },
  {
    id: "rise",
    label: "Rise",
    cssFilter: (i) =>
      `brightness(${1 + 0.12 * i}) contrast(${1 + 0.15 * i}) saturate(${1 + 0.2 * i}) sepia(${0.2 * i})`,
  },
  {
    id: "abril",
    label: "Abril",
    cssFilter: (i) =>
      `contrast(${1 + 0.2 * i}) brightness(${1 + 0.1 * i}) saturate(${1 + 0.3 * i}) hue-rotate(${8 * i}deg)`,
  },
  {
    id: "vintage",
    label: "Vintage",
    cssFilter: (i) =>
      `sepia(${0.45 * i}) contrast(${1 + 0.15 * i}) saturate(${1 - 0.15 * i}) brightness(${1 - 0.05 * i})`,
  },
  {
    id: "sepia",
    label: "Sepia",
    cssFilter: (i) => `sepia(${0.9 * i}) contrast(${1 + 0.08 * i})`,
  },
  {
    id: "grayscale",
    label: "B/N",
    cssFilter: (i) => `grayscale(${1 * i}) contrast(${1 + 0.15 * i})`,
  },
  {
    id: "invert",
    label: "Invertir",
    cssFilter: (i) => `invert(${1 * i})`,
  },
];

export function getFilterCss(filterId: PhotoFilter, intensity: number): string {
  const def = FILTER_DEFINITIONS.find((f) => f.id === filterId);
  if (!def || filterId === "none") return "none";
  return def.cssFilter(intensity);
}

export type FlyoutZone =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export interface FlyoutSettings {
  enabled: boolean;
  zone: FlyoutZone;
  durationMs: number;
  stackVolumeOnTop: boolean;
  showSpectrum: boolean;
  isPinned: boolean;
}

const STORAGE_KEY = "prisma:flyout_settings";

export const DEFAULT_FLYOUT_SETTINGS: FlyoutSettings = {
  enabled: true,
  zone: "bottom-left",
  durationMs: 3000,
  stackVolumeOnTop: true,
  showSpectrum: true,
  isPinned: false,
};

export function getFlyoutSettings(): FlyoutSettings {
  if (typeof window === "undefined") return DEFAULT_FLYOUT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLYOUT_SETTINGS;
    return { ...DEFAULT_FLYOUT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FLYOUT_SETTINGS;
  }
}

export function saveFlyoutSettings(settings: Partial<FlyoutSettings>): FlyoutSettings {
  const current = getFlyoutSettings();
  const next = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Error guardando flyout settings:", err);
  }
  return next;
}

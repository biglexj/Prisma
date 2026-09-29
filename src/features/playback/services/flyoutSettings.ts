import { emit } from "@tauri-apps/api/event";

export const FLYOUT_SETTINGS_EVENT = "prisma://flyout-settings-changed";

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
  durationMs: 1000,
  stackVolumeOnTop: true,
  showSpectrum: true,
  isPinned: false,
};

export function getFlyoutSettings(): FlyoutSettings {
  if (typeof window === "undefined") return DEFAULT_FLYOUT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLYOUT_SETTINGS;
    const saved = JSON.parse(raw);
    let migrated = false;
    if (saved.durationVersion !== 2) {
      saved.durationMs = 1000;
      saved.durationVersion = 2;
      migrated = true;
    }
    if (saved.autoHideVersion !== 1) {
      saved.isPinned = false;
      saved.autoHideVersion = 1;
      migrated = true;
    }
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return { ...DEFAULT_FLYOUT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_FLYOUT_SETTINGS;
  }
}

export function saveFlyoutSettings(settings: Partial<FlyoutSettings>): FlyoutSettings {
  const current = getFlyoutSettings();
  const next = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, durationVersion: 2, autoHideVersion: 1 }));
  } catch (err) {
    console.error("Error guardando flyout settings:", err);
  }
  window.dispatchEvent(new Event(FLYOUT_SETTINGS_EVENT));
  void emit(FLYOUT_SETTINGS_EVENT, next).catch(() => {});
  return next;
}

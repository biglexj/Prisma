import { useCallback, useEffect, useState } from "react";
import type { AlbumPalette } from "../features/playback/ui/useAlbumPalette";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColorId = "purple" | "rose" | "blue" | "emerald" | "amber" | "cyan";
export type BackgroundVariantId = "prisma" | "neutral" | "dark_blue";

export interface AccentColorOption {
  id: AccentColorId;
  label: string;
  colorHex: string;
  badge?: string;
}

export interface BackgroundVariantOption {
  id: BackgroundVariantId;
  label: string;
  desc: string;
  badge?: string;
  colorHex: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: "purple", label: "Morado Prisma", colorHex: "#a855f7", badge: "Destacado" },
  { id: "rose", label: "Rosa Aurora", colorHex: "#f43f5e" },
  { id: "blue", label: "Azul Eléctrico", colorHex: "#3b82f6" },
  { id: "emerald", label: "Verde Esmeralda", colorHex: "#10b981" },
  { id: "amber", label: "Ámbar Cálido", colorHex: "#f59e0b" },
  { id: "cyan", label: "Cyan Neón", colorHex: "#06b6d4" },
];

export const BACKGROUND_VARIANTS: BackgroundVariantOption[] = [
  {
    id: "prisma",
    label: "Tonal Prisma",
    desc: "Ciruela oscuro cálido característico",
    badge: "Predeterminado",
    colorHex: "#1b1216",
  },
  {
    id: "neutral",
    label: "Gris Neutro",
    desc: "Gris carbón neutro / oscuro clásico",
    badge: "Clásico",
    colorHex: "#121214",
  },
  {
    id: "dark_blue",
    label: "Azul Oscuro",
    desc: "Azul profundo nocturno",
    badge: "Nocturno",
    colorHex: "#16161e",
  },
];

const STORAGE_THEME_KEY = "prisma_theme";
const STORAGE_ACCENT_KEY = "prisma_accent";
const STORAGE_BG_VARIANT_KEY = "prisma_bg_variant";
const STORAGE_DYNAMIC_MUSIC_KEY = "prisma_dynamic_music_theme";

function computeIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeAttributes(mode: ThemeMode, accent: AccentColorId, bgVariant: BackgroundVariantId): void {
  const root = document.documentElement;
  const isDark = computeIsDark(mode);

  root.classList.toggle("dark", isDark);
  root.setAttribute("data-theme", mode);
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-bg", bgVariant);
}

const DYNAMIC_CSS_PROPERTIES = [
  "--primary",
  "--on-primary",
  "--primary-container",
  "--on-primary-container",
  "--secondary-container",
  "--shell-gradient",
  "--transport-play-hover",
  "--focus-ring",
  "--state-selected-surface",
];

function applyMusicPaletteTokens(palette: AlbumPalette | null, mode: ThemeMode): void {
  const root = document.documentElement;
  if (!palette) {
    for (const prop of DYNAMIC_CSS_PROPERTIES) {
      root.style.removeProperty(prop);
    }
    root.removeAttribute("data-music-dynamic");
    return;
  }

  const isDark = computeIsDark(mode);

  root.style.setProperty("--primary", palette.accent);
  root.style.setProperty("--on-primary", palette.onAccent);

  if (isDark) {
    root.style.setProperty("--primary-container", palette.primaryContainerDark);
    root.style.setProperty("--on-primary-container", palette.onPrimaryContainerDark);
    root.style.setProperty("--secondary-container", `color-mix(in srgb, ${palette.accent} 20%, #180e12)`);
    root.style.setProperty(
      "--shell-gradient",
      `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${palette.accent} 18%, transparent), transparent 32rem)`
    );
    root.style.setProperty("--transport-play-hover", `color-mix(in srgb, ${palette.accent} 85%, #ffffff)`);
  } else {
    root.style.setProperty("--primary-container", `color-mix(in srgb, ${palette.accent} 16%, #ffffff)`);
    root.style.setProperty("--on-primary-container", `color-mix(in srgb, ${palette.accent} 80%, #0a0608)`);
    root.style.setProperty("--secondary-container", `color-mix(in srgb, ${palette.accent} 12%, #f5eff1)`);
    root.style.setProperty(
      "--shell-gradient",
      `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${palette.accent} 20%, transparent), transparent 32rem)`
    );
    root.style.setProperty("--transport-play-hover", `color-mix(in srgb, ${palette.accent} 85%, #000000)`);
  }

  root.style.setProperty(
    "--focus-ring",
    `color-mix(in srgb, ${palette.accent} 48%, transparent)`
  );
  root.style.setProperty(
    "--state-selected-surface",
    `color-mix(in srgb, ${palette.accent} 16%, var(--surface-container))`
  );
  root.setAttribute("data-music-dynamic", "true");
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY) as ThemeMode | null;
    return saved ?? "system";
  });

  const [accentColor, setAccentColorState] = useState<AccentColorId>(() => {
    const saved = localStorage.getItem(STORAGE_ACCENT_KEY) as AccentColorId | null;
    return saved ?? "purple";
  });

  const [backgroundVariant, setBackgroundVariantState] = useState<BackgroundVariantId>(() => {
    const saved = localStorage.getItem(STORAGE_BG_VARIANT_KEY);
    if (saved === "miku" || saved === "dark_blue") return "dark_blue";
    if (saved === "neutral" || saved === "prisma") return saved;
    return "prisma";
  });

  const [dynamicMusicTheme, setDynamicMusicThemeState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_DYNAMIC_MUSIC_KEY);
    return saved !== null ? saved === "true" : true;
  });

  const [activeMusicPalette, setActiveMusicPalette] = useState<AlbumPalette | null>(null);

  // Aplicar atributos base data-theme, data-accent y data-bg
  useEffect(() => {
    applyThemeAttributes(theme, accentColor, backgroundVariant);
  }, [theme, accentColor, backgroundVariant]);

  // Aplicar tokens adaptativos en tiempo real si hay música sonando y está activado
  useEffect(() => {
    if (dynamicMusicTheme && activeMusicPalette) {
      applyMusicPaletteTokens(activeMusicPalette, theme);
    } else {
      applyMusicPaletteTokens(null, theme);
    }
  }, [dynamicMusicTheme, activeMusicPalette, theme]);

  // Escuchar cambios de preferencia del sistema si el modo es "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        applyThemeAttributes("system", accentColor, backgroundVariant);
        if (dynamicMusicTheme && activeMusicPalette) {
          applyMusicPaletteTokens(activeMusicPalette, "system");
        }
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accentColor, backgroundVariant, dynamicMusicTheme, activeMusicPalette]);

  const setTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(STORAGE_THEME_KEY, mode);
    setThemeState(mode);
  }, []);

  const setAccentColor = useCallback((accent: AccentColorId) => {
    localStorage.setItem(STORAGE_ACCENT_KEY, accent);
    setAccentColorState(accent);
  }, []);

  const setBackgroundVariant = useCallback((variant: BackgroundVariantId) => {
    localStorage.setItem(STORAGE_BG_VARIANT_KEY, variant);
    setBackgroundVariantState(variant);
  }, []);

  const setDynamicMusicTheme = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_DYNAMIC_MUSIC_KEY, String(enabled));
    setDynamicMusicThemeState(enabled);
  }, []);

  const applyMusicPalette = useCallback((palette: AlbumPalette | null) => {
    setActiveMusicPalette(palette);
  }, []);

  return {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    backgroundVariant,
    setBackgroundVariant,
    dynamicMusicTheme,
    setDynamicMusicTheme,
    applyMusicPalette,
    isMusicPaletteActive: Boolean(dynamicMusicTheme && activeMusicPalette),
  };
}

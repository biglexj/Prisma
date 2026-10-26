import { useCallback, useEffect, useState } from "react";
import type { AlbumPalette } from "../features/playback/ui/useAlbumPalette";
import { emitTo, listen } from "@tauri-apps/api/event";
import { FLYOUT_THEME_EVENT, type FlyoutTheme } from "../features/playback/services/flyoutTheme";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColorId = "turquoise" | "purple" | "rose" | "blue" | "emerald" | "amber" | "cyan";
export type BackgroundVariantId = "prisma" | "neutral" | "dark_blue" | "pure" | "classic";

export interface AccentColorOption {
  id: AccentColorId;
  label: string;
  colorHex: string;
}

export interface BackgroundVariantOption {
  id: BackgroundVariantId;
  light: BackgroundVariantTone;
  dark: BackgroundVariantTone;
}

interface BackgroundVariantTone {
  label: string;
  desc: string;
  colorHex: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: "turquoise", label: "Turquesa Ely", colorHex: "#00C9B9" },
  { id: "purple", label: "Morado Prisma", colorHex: "#a855f7" },
  { id: "rose", label: "Rosa Aurora", colorHex: "#f43f5e" },
  { id: "blue", label: "Azul Eléctrico", colorHex: "#3b82f6" },
  { id: "emerald", label: "Verde Esmeralda", colorHex: "#10b981" },
  { id: "amber", label: "Ámbar Cálido", colorHex: "#f59e0b" },
  { id: "cyan", label: "Cyan Neón", colorHex: "#06b6d4" },
];

export const BACKGROUND_VARIANTS: BackgroundVariantOption[] = [
  {
    id: "prisma",
    light: { label: "Marfil Prisma", desc: "Marfil suave con un matiz malva", colorHex: "#faf7f9" },
    dark: { label: "Tonal Prisma", desc: "Ciruela suave con superficies equilibradas", colorHex: "#1b171f" },
  },
  {
    id: "neutral",
    light: { label: "Gris Perla", desc: "Grises claros sin dominante de color", colorHex: "#f7f7f7" },
    dark: { label: "Gris Neutro", desc: "Grafito neutro con contraste suave", colorHex: "#171719" },
  },
  {
    id: "dark_blue",
    light: { label: "Azul Bruma", desc: "Azul grisáceo claro y desaturado", colorHex: "#f4f7fb" },
    dark: { label: "Azul Oscuro", desc: "Azul pizarra con superficies desaturadas", colorHex: "#161c26" },
  },
  {
    id: "pure",
    light: { label: "Blanco Puro", desc: "Blanco puro sin degradado", colorHex: "#ffffff" },
    dark: { label: "Negro Puro", desc: "Negro puro sin degradado", colorHex: "#000000" },
  },
  {
    id: "classic",
    light: { label: "Prisma Clásico", desc: "Rosado suave del tema original", colorHex: "#fff8f7" },
    dark: { label: "Prisma Clásico", desc: "Vino oscuro del tema original", colorHex: "#1b1216" },
  },

];

export function getBackgroundVariants(mode: "light" | "dark") {
  return BACKGROUND_VARIANTS.map(variant => ({ id: variant.id, ...variant[mode] }));
}

const STORAGE_THEME_KEY = "prisma_theme";
const STORAGE_ACCENT_KEY = "prisma_accent";
const STORAGE_BG_VARIANT_KEY = "prisma_bg_variant";
const STORAGE_BG_LIGHT_KEY = "prisma_bg_variant_light";
const STORAGE_BG_DARK_KEY = "prisma_bg_variant_dark";
const STORAGE_DYNAMIC_MUSIC_KEY = "prisma_dynamic_music_theme";

function storedBackgroundVariant(key: string): BackgroundVariantId {
  const saved = localStorage.getItem(key) ?? localStorage.getItem(STORAGE_BG_VARIANT_KEY);
  if (saved === "miku") return "dark_blue";
  return BACKGROUND_VARIANTS.some(variant => variant.id === saved) ? saved as BackgroundVariantId : "prisma";
}

function publishFlyoutTheme(): void {
  const root = document.documentElement;
  const tokens = getComputedStyle(root);
  const primary = tokens.getPropertyValue("--primary").trim();
  const secondaryBase = tokens.getPropertyValue("--on-surface-variant").trim();
  const payload: FlyoutTheme = {
    mode: root.classList.contains("dark") ? "dark" : "light",
    primary,
    secondary: `color-mix(in srgb, ${primary} 45%, ${secondaryBase} 55%)`,
  };
  void emitTo("flyout", FLYOUT_THEME_EVENT, payload).catch(() => {});
}

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
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const [accentColor, setAccentColorState] = useState<AccentColorId>(() => {
    const saved = localStorage.getItem(STORAGE_ACCENT_KEY) as AccentColorId | null;
    return saved ?? "purple";
  });

  const [lightBackgroundVariant, setLightBackgroundVariant] = useState(() => storedBackgroundVariant(STORAGE_BG_LIGHT_KEY));
  const [darkBackgroundVariant, setDarkBackgroundVariant] = useState(() => storedBackgroundVariant(STORAGE_BG_DARK_KEY));
  const backgroundVariant = resolvedTheme === "dark" ? darkBackgroundVariant : lightBackgroundVariant;

  const [dynamicMusicTheme, setDynamicMusicThemeState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_DYNAMIC_MUSIC_KEY);
    return saved !== null ? saved === "true" : true;
  });

  const [activeMusicPalette, setActiveMusicPalette] = useState<AlbumPalette | null>(null);

  // Aplicar atributos base data-theme, data-accent y data-bg
  useEffect(() => {
    applyThemeAttributes(theme, accentColor, backgroundVariant);
  }, [theme, resolvedTheme, accentColor, backgroundVariant]);

  // Aplicar tokens adaptativos en tiempo real si hay música sonando y está activado
  useEffect(() => {
    if (dynamicMusicTheme && activeMusicPalette) {
      applyMusicPaletteTokens(activeMusicPalette, theme);
    } else {
      applyMusicPaletteTokens(null, theme);
    }
    publishFlyoutTheme();
  }, [dynamicMusicTheme, activeMusicPalette, theme, resolvedTheme]);

  useEffect(() => { publishFlyoutTheme(); }, [accentColor, backgroundVariant]);

  useEffect(() => {
    const subscription = listen("prisma://flyout-request-state", publishFlyoutTheme);
    return () => { void subscription.then((unlisten) => unlisten()); };
  }, []);

  // Escuchar cambios de preferencia del sistema si el modo es "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(STORAGE_THEME_KEY, mode);
    setThemeState(mode);
  }, []);

  const setAccentColor = useCallback((accent: AccentColorId) => {
    localStorage.setItem(STORAGE_ACCENT_KEY, accent);
    setAccentColorState(accent);
  }, []);

  const setBackgroundVariant = useCallback((variant: BackgroundVariantId) => {
    if (resolvedTheme === "dark") {
      localStorage.setItem(STORAGE_BG_DARK_KEY, variant);
      setDarkBackgroundVariant(variant);
    } else {
      localStorage.setItem(STORAGE_BG_LIGHT_KEY, variant);
      setLightBackgroundVariant(variant);
    }
  }, [resolvedTheme]);

  const setDynamicMusicTheme = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_DYNAMIC_MUSIC_KEY, String(enabled));
    setDynamicMusicThemeState(enabled);
  }, []);

  const applyMusicPalette = useCallback((palette: AlbumPalette | null) => {
    setActiveMusicPalette(palette);
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
    accentColor,
    setAccentColor,
    backgroundVariant,
    lightBackgroundVariant,
    darkBackgroundVariant,
    setBackgroundVariant,
    dynamicMusicTheme,
    setDynamicMusicTheme,
    applyMusicPalette,
    isMusicPaletteActive: Boolean(dynamicMusicTheme && activeMusicPalette),
  };
}

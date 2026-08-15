import { LibrarySources } from "./LibrarySources";
import type { useMusicLibrary } from "../../features/music_library/useMusicLibrary";
import type { useVisualLibrary } from "../../features/visual_library/useVisualLibrary";
import type { ThemeMode } from "../useTheme";
import "./app-settings.css";

interface AppSettingsProps {
  music: ReturnType<typeof useMusicLibrary>;
  images: ReturnType<typeof useVisualLibrary>;
  videos: ReturnType<typeof useVisualLibrary>;
  onPlay: (path: string) => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

const THEMES: { mode: ThemeMode; label: string; desc: string; previewClass: string }[] = [
  { mode: "light", label: "Claro", desc: "Interfaz luminosa", previewClass: "light-preview" },
  { mode: "dark", label: "Oscuro", desc: "Interfaz oscura", previewClass: "dark-preview" },
  { mode: "system", label: "Automático", desc: "Sigue al sistema", previewClass: "system-preview" },
];

export function AppSettings({ music, images, videos, onPlay, theme, onThemeChange }: AppSettingsProps) {
  return (
    <section className="app-settings-page">
      {/* ── Theme picker ── */}
      <div className="settings-card">
        <h3>Apariencia</h3>
        <p>Elige cómo luce Prisma. El modo automático respeta la preferencia de tu sistema operativo.</p>
        <div className="theme-options-grid">
          {THEMES.map(({ mode, label, desc, previewClass }) => (
            <button
              key={mode}
              className={`theme-card${theme === mode ? " is-selected" : ""}`}
              onClick={() => onThemeChange(mode)}
              aria-pressed={theme === mode}
            >
              <div className={`theme-preview ${previewClass}`} />
              <strong>{label}</strong>
              <small>{desc}</small>
            </button>
          ))}
        </div>
      </div>

      {/* ── Library sources ── */}
      <LibrarySources images={images} music={music} onPlay={onPlay} videos={videos} />
    </section>
  );
}

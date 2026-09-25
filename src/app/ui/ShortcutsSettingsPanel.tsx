import { useMemo, useState } from "react";
import { Icon, type IconName } from "../../shared/ui/Icon";
import type { QuickLookShortcutMode } from "../useSystemSettings";

interface ShortcutsSettingsPanelProps {
  quickLookShortcut: QuickLookShortcutMode;
}

type ShortcutCategoryKey = "all" | "global" | "video" | "music" | "images" | "edit";

interface ShortcutItem {
  id: string;
  label: string;
  keys: string[];
}

interface ShortcutCategory {
  id: Exclude<ShortcutCategoryKey, "all">;
  title: string;
  icon: IconName;
  badgeText: string;
  items: ShortcutItem[];
}

export function ShortcutsSettingsPanel({ quickLookShortcut }: ShortcutsSettingsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const quickLookBadge = useMemo(() => {
    switch (quickLookShortcut) {
      case "space":
        return "Espacio";
      case "alt_space":
        return "Alt + Espacio";
      case "shift_space":
        return "Shift + Espacio";
      default:
        return "Desactivado";
    }
  }, [quickLookShortcut]);

  const categories: ShortcutCategory[] = useMemo(() => {
    return [
      {
        id: "global",
        title: "Controles Globales y Audio",
        icon: "volume",
        badgeText: "Sistema",
        items: [
          { id: "vol_up", label: "Subir volumen (+5%)", keys: ["↑", "+"] },
          { id: "vol_down", label: "Bajar volumen (-5%)", keys: ["↓", "-"] },
          { id: "mute", label: "Silenciar / Restaurar (Mute)", keys: ["M"] },
          { id: "restore_win", label: "Restaurar / Abrir Prisma desde segundo plano", keys: ["Shift + X", "Ctrl + Shift + X"] },
          { id: "bg_listen", label: "Segundo plano (escuchar de fondo sin pausar)", keys: ["H", "Shift + H", "Ctrl + H", "Shift + B"] },
          { id: "close_win", label: "Cerrar ventana (pausa vídeo)", keys: ["Ctrl + W", "Alt + F4"] },
          { id: "play_pause_global", label: "Reproducir / Pausar", keys: ["Espacio"] },
          { id: "quick_look", label: "Previsualización (Quick Look)", keys: [quickLookBadge] },
        ],
      },
      {
        id: "video",
        title: "Vídeo y Reproducción",
        icon: "video",
        badgeText: "Cine",
        items: [
          { id: "play_pause", label: "Reproducir / Pausar", keys: ["Espacio", "K"] },
          { id: "seek_back", label: "Retroceder 10 segundos", keys: ["Shift + ←", "J"] },
          { id: "seek_forward", label: "Avanzar 10 segundos", keys: ["Shift + →", "L"] },
          { id: "prev_next", label: "Vídeo anterior / siguiente", keys: ["←", "→", "P", "N"] },
          { id: "queue", label: "Cola de proyección (Abrir / Cerrar)", keys: ["Q"] },
          { id: "snapshot", label: "Tomar captura de fotograma (Snapshot)", keys: ["Shift + S"] },
          { id: "frame_forward", label: "Avanzar 1 fotograma (Frame forward)", keys: ["E", "."] },
          { id: "frame_backward", label: "Retroceder 1 fotograma (Frame backward)", keys: ["Shift + E", ","] },
          { id: "fullscreen", label: "Pantalla completa", keys: ["F", "F11", "Alt + Enter"] },
          { id: "pip", label: "Ventana flotante (Picture-in-Picture)", keys: ["U"] },
          { id: "subtitles", label: "Activar / Alternar subtítulos", keys: ["V", "C"] },
          { id: "multi_audio", label: "Alternar pista (Multi-audio)", keys: ["B"] },
          { id: "shuffle", label: "Barajar cola (One-shot)", keys: ["S"] },
          { id: "fav", label: "Añadir / Quitar de favoritos", keys: ["D"] },
          { id: "trash", label: "Mover vídeo a la papelera", keys: ["Supr"] },
          { id: "exit", label: "Salir / Volver a la galería", keys: ["Esc"] },
        ],
      },
      {
        id: "music",
        title: "Música y Pistas",
        icon: "music",
        badgeText: "Audio",
        items: [
          { id: "m_play_pause", label: "Reproducir / Pausar", keys: ["Espacio"] },
          { id: "m_seek", label: "Retroceder / Avanzar 10 seg.", keys: ["Shift + ←", "Shift + →"] },
          { id: "m_prev_next", label: "Pista anterior / siguiente", keys: ["P", "N"] },
          { id: "m_lyrics", label: "Alternar panel de Letras", keys: ["L"] },
          { id: "m_queue", label: "Cola de reproducción", keys: ["Q"] },
          { id: "m_mute", label: "Silenciar / Restaurar", keys: ["M"] },
        ],
      },
      {
        id: "images",
        title: "Visor de Imágenes",
        icon: "image",
        badgeText: "Galería",
        items: [
          { id: "i_nav", label: "Imagen anterior / siguiente", keys: ["←", "→"] },
          { id: "i_zoom", label: "Acercar / Alejar zoom", keys: ["Ctrl +", "Ctrl -"] },
          { id: "i_reset_scale", label: "Restablecer escala normal", keys: ["R", "Ctrl + 0"] },
          { id: "i_fullscreen", label: "Pantalla completa", keys: ["F"] },
          { id: "i_slideshow", label: "Presentación automática", keys: ["Espacio"] },
          { id: "i_exif", label: "Información y Metadatos EXIF", keys: ["I"] },
          { id: "i_editor", label: "Editor de Imagen", keys: ["E"] },
          { id: "i_comparator", label: "Comparador de Fotos", keys: ["C"] },
          { id: "i_rename", label: "Renombrar archivo", keys: ["F2"] },
          { id: "i_trash", label: "Mover a la papelera", keys: ["Supr"] },
          { id: "i_close", label: "Cerrar visor", keys: ["Esc", "Q"] },
        ],
      },
      {
        id: "edit",
        title: "Edición y Comparador",
        icon: "sliders",
        badgeText: "Herramientas",
        items: [
          { id: "e_undo", label: "Deshacer trazo (Doodle)", keys: ["Ctrl + Z"] },
          { id: "e_save", label: "Guardar cambios editados", keys: ["Ctrl + S"] },
          { id: "e_modes", label: "Modos comparador (1 a 4)", keys: ["1", "2", "3", "4"] },
          { id: "e_swap", label: "Intercambiar foto primaria", keys: ["S"] },
          { id: "e_exit", label: "Salir de herramienta", keys: ["Esc"] },
        ],
      },
    ];
  }, [quickLookBadge]);

  const totalShortcutsCount = useMemo(() => {
    return categories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [categories]);

  // Filtrado reactivo por categoría y texto
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .filter((cat) => selectedCategory === "all" || cat.id === selectedCategory)
      .map((cat) => {
        if (!query) return cat;

        const filteredItems = cat.items.filter((item) => {
          const matchesLabel = item.label.toLowerCase().includes(query);
          const matchesKey = item.keys.some((k) => k.toLowerCase().includes(query));
          return matchesLabel || matchesKey;
        });

        return { ...cat, items: filteredItems };
      })
      .filter((cat) => cat.items.length > 0);
  }, [categories, selectedCategory, searchQuery]);

  const categoryChips: { key: ShortcutCategoryKey; label: string; icon?: IconName; count: number }[] = useMemo(() => {
    return [
      { key: "all", label: "Todos", count: totalShortcutsCount },
      { key: "global", label: "Globales", icon: "volume", count: categories.find((c) => c.id === "global")?.items.length ?? 0 },
      { key: "video", label: "Vídeo", icon: "video", count: categories.find((c) => c.id === "video")?.items.length ?? 0 },
      { key: "music", label: "Música", icon: "music", count: categories.find((c) => c.id === "music")?.items.length ?? 0 },
      { key: "images", label: "Imágenes", icon: "image", count: categories.find((c) => c.id === "images")?.items.length ?? 0 },
      { key: "edit", label: "Edición", icon: "sliders", count: categories.find((c) => c.id === "edit")?.items.length ?? 0 },
    ];
  }, [categories, totalShortcutsCount]);

  const isSingleView = selectedCategory !== "all" && filteredCategories.length === 1;

  return (
    <div className="settings-card shortcuts-panel-card">
      <div className="shortcuts-header-row">
        <div>
          <h3>Referencia de Atajos de Teclado</h3>
          <p>
            Consulta los atajos rápidos de teclado para controlar la reproducción de vídeos, visor de imágenes y música con máxima agilidad.
          </p>
        </div>
      </div>

      {/* Barra de herramientas: Filtros por chip y buscador */}
      <div className="shortcuts-toolbar">
        <div className="shortcuts-filter-chips" role="tablist" aria-label="Filtro de categorías de atajos">
          {categoryChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`shortcuts-chip-btn ${selectedCategory === chip.key ? "is-active" : ""}`}
              onClick={() => setSelectedCategory(chip.key)}
              role="tab"
              aria-selected={selectedCategory === chip.key}
            >
              {chip.icon ? <Icon name={chip.icon} /> : null}
              <span>{chip.label}</span>
              <span className="shortcuts-chip-count">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="shortcuts-search-wrap">
          <span className="shortcuts-search-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <input
            type="text"
            className="shortcuts-search-input"
            placeholder="Buscar atajo o tecla (ej. volumen, F, zoom)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar atajo de teclado"
          />
          {searchQuery && (
            <button
              type="button"
              className="shortcuts-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Borrar búsqueda"
              title="Borrar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Contenedor de atajos: Masonry fluido o vista enfocada */}
      {filteredCategories.length === 0 ? (
        <div className="shortcuts-empty-state">
          <Icon name="search" />
          <p>No se encontraron atajos que coincidan con <strong>"{searchQuery}"</strong></p>
          <button
            type="button"
            className="shortcuts-chip-btn is-active"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
          >
            Mostrar todos los atajos
          </button>
        </div>
      ) : (
        <div className={isSingleView ? "shortcuts-single-container" : "shortcuts-reference-masonry"}>
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className={`shortcuts-category-card ${isSingleView ? "is-single-view" : ""}`}
            >
              <div className="shortcuts-category-header">
                <h4>
                  <Icon name={category.icon} />
                  <span>{category.title}</span>
                </h4>
                <span className="shortcuts-category-badge">{category.badgeText}</span>
              </div>

              <div className="shortcuts-list">
                {category.items.map((item) => (
                  <div key={item.id} className="shortcut-row">
                    <span className="shortcut-row-label">{item.label}</span>
                    <div className="shortcut-row-keys">
                      {item.keys.map((k) => (
                        <kbd key={k} className="shortcut-kbd-pill">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { AMBIENTS, OVERLAY_SHAPES, SCENARIOS, type EffectLayer } from "../compositor/config";

/** Categorías del catálogo: cada una pertenece a una capa del modelo. */
export type GalleryKind = "ambient" | "dynamic" | "scene" | "particles" | "overlay";

const TITLES: Record<GalleryKind,string> = {
  ambient: "Ambiente", dynamic: "Fondos dinámicos", scene: "Escenarios 3D",
  particles: "Partículas 3D", overlay: "Partículas 2D",
};

interface GalleryItem {
  type: string;
  label: string;
  description: string;
  kind: GalleryKind;
  preview?: string;
  colors?: string;
  glyph?: string;
}

/** El ambiente es una categoría más: por sí solo ya es un fondo. */
const AMBIENT_ITEMS: GalleryItem[] = AMBIENTS.map(item => ({
  type: item.value,
  label: item.value === "original" ? "Sin ambiente" : item.label,
  description: item.value === "original" ? "Deja ver la capa 1 (vídeo o imagen)" : "Atmósfera de color sobre el fondo",
  kind: "ambient",
  colors: item.colors,
}));

/** Partículas 2D: capa independiente, combinable con cualquier fondo. */
const OVERLAY_ITEMS: GalleryItem[] = OVERLAY_SHAPES.map(item => ({
  type: item.value,
  label: item.label,
  description: "Partícula 2D sobre el lienzo",
  kind: "overlay",
  glyph: item.glyph,
}));

const SCENE_ITEMS: GalleryItem[] = SCENARIOS.map(item => ({
  type: item.type,
  label: item.label,
  description: item.description,
  kind: item.category === "particles" ? "particles" : item.category === "3d" ? "scene" : "dynamic",
  preview: item.preview,
}));

const ALL_ITEMS = [...AMBIENT_ITEMS, ...SCENE_ITEMS, ...OVERLAY_ITEMS];

const CLEAR_LABEL: Record<GalleryKind, string> = {
  ambient: "Sin ambiente",
  dynamic: "Sin fondo dinámico",
  scene: "Sin escenario",
  particles: "Sin partículas 3D",
  overlay: "Sin partículas 2D",
};

export function SceneGallery({ layer, selected, onSelect }: {
  layer: EffectLayer | "overlay";
  selected: string;
  onSelect(kind: GalleryKind, type: string): void;
}) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => ALL_ITEMS.filter(item => {
    const match = item.kind === layer;
    return match && `${item.label} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [layer, query]);
  const clear = () => onSelect(layer === "overlay" ? "overlay" : layer, layer === "ambient" ? "original" : "none");
  return <section className="scene-gallery" aria-label={`Galería de ${TITLES[layer]}`}>
    <header className="scene-gallery-header">
      <div><h2>{TITLES[layer]}</h2><span>{items.length} opciones</span></div>
      <input type="search" aria-label="Buscar efectos" placeholder="Buscar un efecto…" value={query} onChange={e => setQuery(e.target.value)} />
    </header>
    <div className="scene-gallery-filters">
      <button type="button" className="scene-clear" aria-pressed={selected === "none" || selected === "original"} onClick={clear}>
        {CLEAR_LABEL[layer]}
      </button>
    </div>
    <div className="scene-gallery-grid">
      {items.map(item => <button key={`${item.kind}-${item.type}`} type="button"
        className={`scene-card ${layer === item.kind && selected === item.type ? "is-selected" : ""}`}
        aria-pressed={layer === item.kind && selected === item.type} onClick={() => onSelect(item.kind, item.type)} aria-label={`Seleccionar ${item.label}`}>
        <div className="scene-card-preview">
          {item.colors ? <i className="scene-card-swatch" style={{ background: item.colors }} />
            : item.glyph ? <i className="scene-card-glyph">{item.glyph}</i>
            : <img src={item.preview} loading="lazy" decoding="async" alt=""
              onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}
          {layer === item.kind && selected === item.type && <span className="scene-selected-badge">Seleccionado</span>}
        </div>
        <strong>{item.label}</strong><span>{item.description}</span>
      </button>)}
    </div>
    {items.length === 0 && <p>No hay efectos que coincidan con la búsqueda.</p>}
  </section>;
}

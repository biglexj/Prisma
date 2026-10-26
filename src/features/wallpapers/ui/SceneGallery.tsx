import { useMemo, useState } from "react";
import { AMBIENTS, OVERLAY_SHAPES, SCENARIOS } from "../compositor/config";

/** Categorías del catálogo: cada una pertenece a una capa del modelo. */
export type GalleryKind = "ambient" | "scene" | "overlay";

const TITLES: Record<GalleryKind,string> = {
  ambient: "Ambiente", scene: "Escenarios 3D", overlay: "Partículas",
};

interface GalleryItem {
  type: string;
  label: string;
  description: string;
  kind: GalleryKind;
  preview?: string;
  colors?: string;
  glyph?: string;
  group?: string;
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
  kind: "scene",
  group: item.uiGroup,
  preview: item.preview,
}));

const ALL_ITEMS = [...AMBIENT_ITEMS, ...SCENE_ITEMS, ...OVERLAY_ITEMS];

const CLEAR_LABEL: Record<GalleryKind, string> = {
  ambient: "Sin ambiente",
  scene: "Sin escenario",
  overlay: "Sin partículas",
};

export function SceneGallery({ layer, selected, isLayerActive = true, onSelect }: {
  layer: GalleryKind;
  selected: string;
  isLayerActive?: boolean;
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
    {(layer === "scene"
      ? ["Escenarios 3D", "Efectos 3D"].map(label=>({label,items:items.filter(item=>item.group===label)}))
      : [{label:"",items}]).filter(group=>group.items.length>0).map(group=><section key={group.label || layer} aria-label={group.label || TITLES[layer]}>
      {group.label && <h3 className="scene-group-title">{group.label}</h3>}
      <div className="scene-gallery-grid">
      {group.items.map(item => {
        const isSelected = layer === item.kind && selected === item.type;
        return <button key={`${item.kind}-${item.type}`} type="button"
          className={`scene-card ${isSelected ? (isLayerActive ? "is-selected" : "is-selected is-deactivated") : ""}`}
          aria-pressed={isSelected} onClick={() => onSelect(item.kind, item.type)} aria-label={`Seleccionar ${item.label}`}
          title={isSelected && !isLayerActive ? "Efecto desactivado. Pulsa para activarlo" : undefined}>
          <div className="scene-card-preview">
            {item.colors ? <i className="scene-card-swatch" style={{ background: item.colors }} />
              : item.glyph ? <i className="scene-card-glyph">{item.glyph}</i>
              : <img src={item.preview} loading="lazy" decoding="async" alt=""
                onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}
            {isSelected && <span className={`scene-selected-badge ${isLayerActive ? "is-active" : "is-inactive"}`}>{isLayerActive ? "Activo" : "Desactivado"}</span>}
          </div>
          <strong>{item.label}</strong><span>{item.description}</span>
        </button>;
      })}
      </div>
    </section>)}
    {items.length === 0 && <p>No hay efectos que coincidan con la búsqueda.</p>}
  </section>;
}

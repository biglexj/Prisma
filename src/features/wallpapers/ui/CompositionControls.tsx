import { useState, useEffect } from "react";
import { OVERLAY_DIRECTIONS, OVERLAY_SHAPES, SCENARIOS, BACKGROUND_MOTIONS, BACKGROUND_VIEWS,
  DEFAULT_LAYER_CONTROLS, getLayerControls, layerKey,
  type EffectLayer, type Layer, type LayerControls } from "../compositor/config";
import { useCompositionConfig } from "./useCompositionConfig";
import { SceneGallery } from "./SceneGallery";
import { CustomSelect } from "../../../shared/ui/CustomSelect";
import "./composition-studio.css";

export type CompositionCategory = "ambient" | "scene" | "particles" | "parallax";
const HINTS: Record<CompositionCategory,string> = {
  ambient: "Capa 2 · por sí solo ya es un fondo",
  scene: "Escenarios y efectos de Aurora",
  particles: "Partículas independientes sobre cualquier fondo",
  parallax: "Profundidad con el cursor",
};

function Slider({label,value,min,max,step=0.1,onChange}: {
  label:string;value:number;min:number;max:number;step?:number;onChange(value:number):void;
}) {
  return <label className="scene-field scene-slider">
    <span className="scene-field-title"><span>{label}</span><output>{Number(value.toFixed(2))}</output></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/>
  </label>;
}

function ColorField({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  ariaLabel?: string;
}) {
  const normalized = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#00C9B9";
  const [text, setText] = useState(normalized.replace(/^#/, "").toUpperCase());

  useEffect(() => {
    setText(normalized.replace(/^#/, "").toUpperCase());
  }, [normalized]);

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next.replace(/^#/, "").toUpperCase());
    onChange(next);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (val.startsWith("#")) val = val.slice(1);
    const cleaned = val.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
    setText(cleaned);
    if (cleaned.length === 6) {
      onChange(`#${cleaned}`);
    }
  };

  const handleBlur = () => {
    if (text.length === 6) {
      onChange(`#${text}`);
    } else if (text.length === 3) {
      const expanded = text.split("").map(c => c + c).join("");
      setText(expanded);
      onChange(`#${expanded}`);
    } else {
      setText(normalized.replace(/^#/, "").toUpperCase());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="scene-field scene-color-field">
      <span className="scene-field-title">{label}</span>
      <div className="scene-color-picker-wrapper">
        <input
          type="color"
          aria-label={ariaLabel ?? label}
          value={normalized}
          onChange={handlePickerChange}
          className="scene-color-picker-input"
        />
      </div>
      <div className="scene-hex-row" title={`Código hexadecimal para ${label}`}>
        <span className="scene-hex-prefix">#</span>
        <input
          type="text"
          className="scene-hex-input"
          aria-label={`Código hexadecimal para ${label}`}
          placeholder="00C9B9"
          maxLength={6}
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function CompositionControls({ enabled, category }: { enabled: boolean; category: CompositionCategory }) {
  const {config,error,update,select} = useCompositionConfig();
  if (!config) return <section className="composition-studio">{error ? <p role="alert">{error}</p> : <p>Cargando efectos de Aurora…</p>}</section>;
  const selectedScenario = config.scenario !== "none" ? config.scenario : config.dynamic !== "none" ? config.dynamic : config.particle;
  const scenarioEntry = SCENARIOS.find(item=>item.type === selectedScenario);
  // La agrupación visual es la de Aurora. La ruta interna solo decide qué motor recibe el efecto.
  const layer: Layer = category === "particles" ? "overlay" : category === "scene"
    ? scenarioEntry?.category === "dynamic" ? "dynamic" : scenarioEntry?.category === "particles" ? "particles" : "scene" : category;
  const controlLayer: EffectLayer = layer === "ambient" || layer === "dynamic" || layer === "scene" || layer === "particles" ? layer : "scene";
  const settings = getLayerControls(config, controlLayer);
  const overlay = config.overlay;
  const selectedType = layer === "ambient" ? config.ambient : layer === "dynamic" ? config.dynamic
    : layer === "scene" ? config.scenario : layer === "particles" ? config.particle : overlay.enabled ? overlay.shape : "none";
  const selected = SCENARIOS.find(item=>item.type === selectedType);
  const flatAmbient = layer === "ambient" && (config.ambient === "solid" || config.ambient === "gradient");
  const spatial = (layer === "ambient" && !flatAmbient) || selected?.spatial === true;
  const hasEffect = layer === "ambient" ? config.ambient !== "original"
    : layer === "overlay" ? overlay.enabled
    : layer === "dynamic" ? config.dynamic !== "none"
    : layer === "scene" ? config.scenario !== "none" : config.particle !== "none";
  const visibilityKey = layer === "scene" ? "scenario" : layer === "particles" ? "particles"
    : layer === "dynamic" ? "dynamic" : "ambient";

  const isLayerActive = layer === "ambient"
    ? (config.ambient !== "original" && config.visibility.ambient)
    : layer === "overlay"
    ? overlay.enabled
    : layer === "parallax"
    ? config.parallax.enabled
    : (hasEffect && config.visibility[visibilityKey]);

  const handleToggleActive = (nextActive: boolean) => {
    if (layer === "ambient") {
      if (nextActive) {
        if (config.ambient === "original") {
          void select(c => ({
            ...c,
            ambient: "solid",
            ambientColor: (!c.ambientColor || c.ambientColor === "#263b62") ? "#00C9B9" : c.ambientColor,
            visibility: { ...c.visibility, ambient: true },
          }), enabled);
        } else {
          update(c => ({ ...c, visibility: { ...c.visibility, ambient: true } }));
        }
      } else {
        update(c => ({ ...c, visibility: { ...c.visibility, ambient: false } }));
      }
    } else if (layer === "overlay") {
      patchOverlay({
        enabled: nextActive,
      });
    } else if (layer === "parallax") {
      update(c => ({ ...c, parallax: { ...c.parallax, enabled: nextActive } }));
    } else {
      if (nextActive) {
        if (!hasEffect) {
          const fallbackType = layer === "particles" ? "bubbles" : "aurora";
          const effect = SCENARIOS.find(item => item.type === fallbackType);
          const field = effect?.category === "dynamic" ? "dynamic" : effect?.category === "particles" ? "particle" : "scenario";
          const visKey = field === "scenario" ? "scenario" : field === "particle" ? "particles" : "dynamic";
          void select(c => ({
            ...c,
            scenario: "none",
            dynamic: "none",
            particle: "none",
            [field]: fallbackType,
            visibility: { ...c.visibility, [visKey]: true },
          }), enabled);
        } else {
          update(c => ({ ...c, visibility: { ...c.visibility, [visibilityKey]: true } }));
        }
      } else {
        update(c => ({ ...c, visibility: { ...c.visibility, [visibilityKey]: false } }));
      }
    }
  };

  const patch = (value:Partial<LayerControls>) => update(current => ({...current,
    controls:{...current.controls,[layerKey(current,controlLayer)]:{...getLayerControls(current,controlLayer),...value}}}));
  const patchOverlay = (value:Partial<typeof overlay>) => update(current => ({...current,overlay:{...current.overlay,...value}}));
  const parallaxAvailable = (config.visibility.ambient && config.ambient !== "original") ||
    SCENARIOS.some(item=>item.spatial && ((config.visibility.scenario && item.type===config.scenario) || (config.visibility.particles && item.type===config.particle)));
  const title = layer === "ambient" ? "Fondo de ambiente" : layer === "dynamic" ? (selected?.label ?? "Sin fondo dinámico")
    : layer === "scene" ? (selected?.label ?? "Sin escenario") : layer === "particles" ? (selected?.label ?? "Sin partículas")
    : layer === "overlay" ? "Partículas sobre el lienzo" : "Profundidad con el cursor";
  const hint = HINTS[category];

  const statusText = !isLayerActive
    ? "Desactivado · Activa el switch para aplicarlo en el escritorio"
    : enabled
    ? "Aplicado en el escritorio"
    : "Configura el efecto y pulsa Activar fondo";

  return <div className="composition-studio">
    <section className="composition-layer-panel">
      <div>
        <header className="scene-controls-heading">
          <div>
            <strong>{title}</strong>
            <span>{hint} · {statusText}</span>
          </div>
          <div className="scene-layer-actions">
            <label
              className="scene-switch-toggle"
              title={isLayerActive
                ? (layer === "ambient" ? "Desactivar ambiente" : "Desactivar efecto")
                : (layer === "ambient" ? "Activar ambiente" : "Activar efecto")}
            >
              <span className={`scene-switch-label ${isLayerActive ? "is-active" : "is-inactive"}`}>
                {isLayerActive ? "Activado" : "Desactivado"}
              </span>
              <span className="scene-switch-control">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={isLayerActive}
                  aria-label={isLayerActive
                    ? (layer === "ambient" ? "Desactivar ambiente" : "Desactivar efecto")
                    : (layer === "ambient" ? "Activar ambiente" : "Activar efecto")}
                  checked={isLayerActive}
                  onChange={e => handleToggleActive(e.target.checked)}
                />
                <span className="scene-switch-slider" />
              </span>
            </label>
            {layer !== "parallax" && (
              <>
                <button
                  type="button"
                  disabled={!hasEffect || !isLayerActive}
                  aria-pressed={layer === "overlay" ? overlay.paused : settings.paused}
                  onClick={() => layer === "overlay" ? patchOverlay({ paused: !overlay.paused }) : patch({ paused: !settings.paused })}
                >
                  {(layer === "overlay" ? overlay.paused : settings.paused) ? "Reanudar capa" : "Pausar capa"}
                </button>
                {layer !== "overlay" && (
                  <button
                    type="button"
                    disabled={!hasEffect || !isLayerActive}
                    onClick={() => patch({ ...DEFAULT_LAYER_CONTROLS })}
                  >
                    Restablecer capa
                  </button>
                )}
              </>
            )}
          </div>
        </header>
        <div className={`scene-controls-content ${!isLayerActive ? "is-layer-inactive" : ""}`}>
          {layer === "parallax" ? <div className="scene-control-grid scene-parallax-grid">
            <label className="scene-toggle-card">
              <span className="scene-switch-control">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Seguir el cursor"
                  checked={config.parallax.enabled}
                  onChange={e=>update(c=>({...c,parallax:{...c.parallax,enabled:e.target.checked}}))}
                />
                <span className="scene-switch-slider" />
              </span>
              <span>Seguir el cursor</span>
            </label>
            <Slider label="Fuerza de profundidad" min={0} max={2} value={config.parallax.strength}
              onChange={strength=>update(c=>({...c,parallax:{...c.parallax,strength}}))}/>
            <label className="scene-toggle-card">
              <span className="scene-switch-control">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Aplicar también al vídeo o imagen"
                  checked={config.parallax.base ?? true}
                  onChange={e=>update(c=>({...c,parallax:{...c.parallax,base:e.target.checked}}))}
                />
                <span className="scene-switch-slider" />
              </span>
              <span>Aplicar también al vídeo o imagen</span>
            </label>
            <p>Desplaza el fondo y las capas con cámara al mover el cursor. Los clics del escritorio permanecen libres.
              {!parallaxAvailable && " También funciona con una foto o un vídeo como base."}</p>
          </div> : layer === "overlay" ? <div className="scene-control-grid">
            <div className="scene-field">
              <span className="scene-field-title">Forma</span>
              <CustomSelect
                aria-label="Forma de la partícula"
                value={overlay.shape}
                options={OVERLAY_SHAPES.map(item => ({ value: item.value, label: `${item.glyph} ${item.label}` }))}
                onChange={shape => patchOverlay({ shape: shape as typeof overlay.shape })}
              />
            </div>
            <div className="scene-field">
              <span className="scene-field-title">Dirección</span>
              <CustomSelect
                aria-label="Dirección de la partícula"
                value={overlay.direction}
                options={OVERLAY_DIRECTIONS.map(item => ({ value: item.value, label: item.label }))}
                onChange={direction => patchOverlay({ direction: direction as typeof overlay.direction })}
              />
            </div>
            <ColorField
              label="Color"
              ariaLabel="Color de la partícula"
              value={(!overlay.color || overlay.color === "#b8efff" || overlay.color.toUpperCase() === "#691BDE") ? "#00C9B9" : overlay.color}
              onChange={color => patchOverlay({ color })}
            />
            <Slider label="Tamaño" min={0.25} max={4} value={overlay.size} onChange={size=>patchOverlay({size})}/>
            <Slider label="Densidad" min={0.1} max={3} value={overlay.density} onChange={density=>patchOverlay({density})}/>
            <Slider label="Velocidad" min={0.1} max={3} value={overlay.speed} onChange={speed=>patchOverlay({speed})}/>
            <Slider label="Opacidad" min={0} max={1} value={overlay.opacity} onChange={opacity=>patchOverlay({opacity})}/>
            <p>Esta capa se dibuja sobre cualquier fondo: un vídeo, una foto o un escenario 3D.</p>
          </div> : <>
            {layer === "ambient" && flatAmbient && <div className="scene-control-grid">
              <ColorField
                label="Color"
                ariaLabel="Color del ambiente"
                value={config.ambientColor}
                onChange={ambientColor => update(c => ({ ...c, ambientColor }))}
              />
              {config.ambient === "gradient" && (
                <ColorField
                  label="Segundo color"
                  ariaLabel="Segundo color del ambiente"
                  value={config.ambientColor2}
                  onChange={ambientColor2 => update(c => ({ ...c, ambientColor2 }))}
                />
              )}
              <Slider label="Opacidad del ambiente" min={0} max={1} step={0.05} value={config.ambientOpacity} onChange={ambientOpacity=>update(c=>({...c,ambientOpacity}))}/>
            </div>}
            {hasEffect && !flatAmbient ? <><div className="scene-control-grid">
              {spatial && <>
                <div className="scene-field">
                  <span className="scene-field-title">Vista de cámara</span>
                  <CustomSelect
                    aria-label="Vista de cámara"
                    value={settings.view}
                    options={BACKGROUND_VIEWS.map(item => ({ value: item.value, label: item.label }))}
                    onChange={view => patch({ view: view as LayerControls['view'] })}
                  />
                </div>
                <div className="scene-field">
                  <span className="scene-field-title">Movimiento</span>
                  <CustomSelect
                    aria-label="Movimiento de cámara"
                    value={settings.motion}
                    options={BACKGROUND_MOTIONS.map(item => ({ value: item.value, label: item.label }))}
                    onChange={motion => patch({ motion: motion as LayerControls['motion'] })}
                  />
                </div>
              </>}
              <Slider label="Velocidad" min={0.1} max={3} value={settings.speed} onChange={speed=>patch({speed})}/>
              <Slider label="Zoom" min={0.1} max={2.5} step={0.05} value={settings.zoom} onChange={zoom=>patch({zoom})}/>
              <Slider label="Horizontal" min={-10} max={10} step={0.5} value={settings.panX} onChange={panX=>patch({panX})}/>
              <Slider label="Vertical" min={-10} max={10} step={0.5} value={settings.panY} onChange={panY=>patch({panY})}/>
              {spatial && <>
                <Slider label="Giro" min={-180} max={180} step={1} value={settings.yaw} onChange={yaw=>patch({yaw})}/>
                <Slider label="Inclinación" min={-80} max={80} step={1} value={settings.pitch} onChange={pitch=>patch({pitch})}/>
              </>}
            </div>
            <div className="scene-control-extras">
              <label><input type="checkbox" checked={settings.colorCycle} onChange={e=>patch({colorCycle:e.target.checked})}/> Colores cambiantes</label>
              {layer === "scene" && selected?.type === "gargantua" && (
                <div className="scene-field scene-inline-field">
                  <span className="scene-field-title">Detalle</span>
                  <CustomSelect
                    aria-label="Detalle de Gargantúa"
                    value={settings.quality}
                    options={[
                      { value: 0, label: "Ligero" },
                      { value: 1, label: "Alto" },
                      { value: 2, label: "Cine" },
                    ]}
                    onChange={quality => patch({ quality: Number(quality) as 0 | 1 | 2 })}
                  />
                </div>
              )}
            </div>
            </> : !hasEffect && <p>Elige un efecto para ajustar esta capa.</p>}
          </>}
          {category === "scene" && selected?.type === "bubbles" && <p className="scene-interaction-hint">Haz clic cerca de una burbuja en el escritorio para hacerla explotar.</p>}
          {category === "scene" && selected?.type === "morphclick" && <p className="scene-interaction-hint">Cada clic en el escritorio cambia la forma del Nexo Cuántico.</p>}
        </div>
        {error && <p className="live-wallpapers-error-banner" role="alert">{error}</p>}
      </div>
    </section>
    {layer !== "parallax" && <SceneGallery key={category} layer={category === "particles" ? "overlay" : category === "ambient" ? "ambient" : "scene"} selected={selectedType}
      isLayerActive={isLayerActive}
      onSelect={(kind,type)=>{
        if(kind==="ambient") void select(c=>({...c,ambient:type,ambientColor:(!c.ambientColor||c.ambientColor==="#263b62")?"#00C9B9":c.ambientColor,visibility:{...c.visibility,ambient:type !== "original"}}),enabled || type === "original");
        else if(kind==="scene") void select(c=>{
          const effect = SCENARIOS.find(item=>item.type===type);
          const field = effect?.category === "dynamic" ? "dynamic" : effect?.category === "particles" ? "particle" : "scenario";
          const visibility = field === "scenario" ? "scenario" : field === "particle" ? "particles" : "dynamic";
          return {...c,scenario:"none",dynamic:"none",particle:"none",[field]:type,
            visibility:{...c.visibility,[visibility]:type !== "none"}};
        },enabled || type === "none");
        else void select(c=>({...c,overlay:{...c.overlay,...(type === "none" ? {enabled:false} : {shape:type as typeof c.overlay.shape,enabled:true,color:(!c.overlay.color || c.overlay.color === "#b8efff" || c.overlay.color.toUpperCase() === "#691BDE") ? "#00C9B9" : c.overlay.color})}}),enabled || type === "none");
      }}/>}
  </div>;
}

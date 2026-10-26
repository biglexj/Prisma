import { OVERLAY_DIRECTIONS, OVERLAY_SHAPES, SCENARIOS, BACKGROUND_MOTIONS, BACKGROUND_VIEWS,
  DEFAULT_LAYER_CONTROLS, getLayerControls, layerKey,
  type EffectLayer, type Layer, type LayerControls } from "../compositor/config";
import { useCompositionConfig } from "./useCompositionConfig";
import { SceneGallery } from "./SceneGallery";

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
  return <label className="scene-slider"><span>{label} <output>{Number(value.toFixed(2))}</output></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/>
  </label>;
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
  const patch = (value:Partial<LayerControls>) => update(current => ({...current,
    controls:{...current.controls,[layerKey(current,controlLayer)]:{...getLayerControls(current,controlLayer),...value}}}));
  const patchOverlay = (value:Partial<typeof overlay>) => update(current => ({...current,overlay:{...current.overlay,...value}}));
  const parallaxAvailable = (config.visibility.ambient && config.ambient !== "original") ||
    SCENARIOS.some(item=>item.spatial && ((config.visibility.scenario && item.type===config.scenario) || (config.visibility.particles && item.type===config.particle)));
  const title = layer === "ambient" ? "Fondo de ambiente" : layer === "dynamic" ? (selected?.label ?? "Sin fondo dinámico")
    : layer === "scene" ? (selected?.label ?? "Sin escenario") : layer === "particles" ? (selected?.label ?? "Sin partículas")
    : layer === "overlay" ? "Partículas sobre el lienzo" : "Profundidad con el cursor";
  const hint = HINTS[category];
  return <div className="composition-studio">
    <section className="composition-layer-panel">
      <div>
        <header className="scene-controls-heading">
          <div><strong>{title}</strong>
            <span>{hint} · {enabled ? "Aplicado en el escritorio" : "Configura el efecto y pulsa Activar fondo"}</span></div>
          {layer !== "parallax" && <div className="scene-layer-actions">
            {layer === "overlay"
              ? <label><input type="checkbox" checked={overlay.enabled} onChange={e=>patchOverlay({enabled:e.target.checked})}/> Activar capa</label>
              : <label><input type="checkbox" checked={config.visibility[visibilityKey]} onChange={e=>update(c=>({...c,visibility:{...c.visibility,[visibilityKey]:e.target.checked}}))}/> Visible</label>}
            <button type="button" disabled={!hasEffect} aria-pressed={layer === "overlay" ? overlay.paused : settings.paused}
              onClick={()=>layer === "overlay" ? patchOverlay({paused:!overlay.paused}) : patch({paused:!settings.paused})}>
              {(layer === "overlay" ? overlay.paused : settings.paused) ? "Reanudar capa" : "Pausar capa"}</button>
            {layer !== "overlay" && <button type="button" disabled={!hasEffect} onClick={()=>patch({...DEFAULT_LAYER_CONTROLS})}>Restablecer capa</button>}
          </div>}
        </header>
        {layer === "parallax" ? <div className="scene-control-grid">
          <label className="scene-toggle-card"><input type="checkbox" checked={config.parallax.enabled}
            onChange={e=>update(c=>({...c,parallax:{...c.parallax,enabled:e.target.checked}}))}/> Seguir el cursor</label>
          <Slider label="Fuerza de profundidad" min={0} max={2} value={config.parallax.strength}
            onChange={strength=>update(c=>({...c,parallax:{...c.parallax,strength}}))}/>
          <label className="scene-toggle-card"><input type="checkbox" checked={config.parallax.base ?? true} onChange={e=>update(c=>({...c,parallax:{...c.parallax,base:e.target.checked}}))}/> Aplicar también al vídeo o imagen</label>
          <p>Desplaza el fondo y las capas con cámara al mover el cursor. Los clics del escritorio permanecen libres.
            {!parallaxAvailable && " También funciona con una foto o un vídeo como base."}</p>
        </div> : layer === "overlay" ? <div className="scene-control-grid">
          <label>Forma<select aria-label="Forma de la partícula" value={overlay.shape} onChange={e=>patchOverlay({shape:e.target.value as typeof overlay.shape})}>
            {OVERLAY_SHAPES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
          </select></label>
          <label>Dirección<select aria-label="Dirección de la partícula" value={overlay.direction} onChange={e=>patchOverlay({direction:e.target.value as typeof overlay.direction})}>
            {OVERLAY_DIRECTIONS.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
          </select></label>
          <label>Color<input aria-label="Color de la partícula" type="color" value={overlay.color} onChange={e=>patchOverlay({color:e.target.value})}/></label>
          <Slider label="Tamaño" min={0.25} max={4} value={overlay.size} onChange={size=>patchOverlay({size})}/>
          <Slider label="Densidad" min={0.1} max={3} value={overlay.density} onChange={density=>patchOverlay({density})}/>
          <Slider label="Velocidad" min={0.1} max={3} value={overlay.speed} onChange={speed=>patchOverlay({speed})}/>
          <Slider label="Opacidad" min={0} max={1} value={overlay.opacity} onChange={opacity=>patchOverlay({opacity})}/>
          <p>Esta capa se dibuja sobre cualquier fondo: un vídeo, una foto o un escenario 3D.</p>
        </div> : <>
          {layer === "ambient" && flatAmbient && <div className="scene-control-grid">
            <label>Color<input aria-label="Color del ambiente" type="color" value={config.ambientColor} onChange={e=>update(c=>({...c,ambientColor:e.target.value}))}/></label>
            {config.ambient === "gradient" && <label>Segundo color<input aria-label="Segundo color del ambiente" type="color" value={config.ambientColor2} onChange={e=>update(c=>({...c,ambientColor2:e.target.value}))}/></label>}
            <Slider label="Opacidad del ambiente" min={0} max={1} step={0.05} value={config.ambientOpacity} onChange={ambientOpacity=>update(c=>({...c,ambientOpacity}))}/>
          </div>}
          {hasEffect && !flatAmbient ? <><div className="scene-control-grid">
            {spatial && <>
              <label>Vista de cámara<select aria-label="Vista de cámara" value={settings.view} onChange={e=>patch({view:e.target.value as LayerControls['view']})}>
                {BACKGROUND_VIEWS.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
              </select></label>
              <label>Movimiento<select aria-label="Movimiento de cámara" value={settings.motion} onChange={e=>patch({motion:e.target.value as LayerControls['motion']})}>
                {BACKGROUND_MOTIONS.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
              </select></label>
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
            {layer === "scene" && selected?.type === "gargantua" && <label>Detalle<select aria-label="Detalle de Gargantúa" value={settings.quality} onChange={e=>patch({quality:Number(e.target.value) as 0|1|2})}>
              <option value={0}>Ligero</option><option value={1}>Alto</option><option value={2}>Cine</option></select></label>}
          </div>
          </> : !hasEffect && <p>Elige un efecto para ajustar esta capa.</p>}
        </>}
        {error && <p className="live-wallpapers-error-banner" role="alert">{error}</p>}
      </div>
    </section>
    {layer !== "parallax" && <SceneGallery key={category} layer={category === "particles" ? "overlay" : category === "ambient" ? "ambient" : "scene"} selected={selectedType}
      onSelect={(kind,type)=>{
        if(kind==="ambient") void select(c=>({...c,ambient:type,visibility:{...c.visibility,ambient:true}}),enabled || type === "original");
        else if(kind==="scene") void select(c=>{
          const effect = SCENARIOS.find(item=>item.type===type);
          const field = effect?.category === "dynamic" ? "dynamic" : effect?.category === "particles" ? "particle" : "scenario";
          const visibility = field === "scenario" ? "scenario" : field === "particle" ? "particles" : "dynamic";
          return {...c,scenario:"none",dynamic:"none",particle:"none",[field]:type,
            visibility:{...c.visibility,[visibility]:true}};
        },enabled || type === "none");
        else void select(c=>({...c,overlay:{...c.overlay,...(type === "none" ? {enabled:false} : {shape:type as typeof c.overlay.shape,enabled:true})}}),enabled || type === "none");
      }}/>}
  </div>;
}

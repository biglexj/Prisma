import React, { useId, useMemo, useRef, useState } from "react";
import { EQ_BAND_RANGES, EQ_FREQUENCIES, type DspEffectsConfig } from "../model/types";
import { useDspController } from "../useDspController";
import { Icon } from "../../../shared/ui/Icon";
import "./dsp-equalizer.css";

const SPECTRUM_BAR_COUNT = 52;

// Perfil de envolvente acústica orgánica multi-armónica (no lineal)
const SPECTRUM_BARS = Array.from({ length: SPECTRUM_BAR_COUNT }, (_, i) => {
  const norm = i / (SPECTRUM_BAR_COUNT - 1); // 0.0 a 1.0
  const bassEnv = Math.exp(-Math.pow((norm - 0.12) / 0.14, 2));
  const midEnv = Math.exp(-Math.pow((norm - 0.45) / 0.22, 2)) * 0.85;
  const trebleEnv = Math.exp(-Math.pow((norm - 0.82) / 0.18, 2)) * 0.7;
  const compositeEnv = Math.max(bassEnv, midEnv, trebleEnv, 0.15);

  const peakPct = Math.min(94, Math.max(22, compositeEnv * 90 + (Math.sin(i * 1.3) * 8)));
  const minPct = Math.max(8, peakPct * 0.22);
  const dur = 0.85 + (i % 7) * 0.18;
  const delay = (i % 5) * 0.12;
  const animType = i < 16 ? "dspBassPulse" : i < 36 ? "dspMidPulse" : "dspTreblePulse";

  return {
    id: i,
    peakPct,
    minPct,
    dur,
    delay,
    animType,
  };
});

interface DspRotaryKnobProps {
  value: number; // frecuencia en Hz
  min: number;
  max: number;
  defaultValue?: number;
  onChange: (newFreq: number) => void;
  ariaLabel?: string;
}

function DspRotaryKnob({
  value,
  min,
  max,
  defaultValue,
  onChange,
  ariaLabel,
}: DspRotaryKnobProps) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  // Normalizado 0 a 1
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  // Ángulo de -135deg a +135deg (270 grados de barrido)
  const angle = -135 + norm * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const stepRange = max - min;
    const deltaRatio = deltaY / 140; // 140px de arrastre = recorrido completo
    const nextVal = Math.round(Math.max(min, Math.min(max, startValRef.current + deltaRatio * stepRange)));
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
      isDraggingRef.current = false;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const stepRange = (max - min) * 0.05;
    const dir = e.deltaY < 0 ? 1 : -1;
    const nextVal = Math.round(Math.max(min, Math.min(max, value + dir * stepRange)));
    onChange(nextVal);
  };

  const handleDoubleClick = () => {
    if (typeof defaultValue === "number") {
      onChange(defaultValue);
    }
  };

  // Coordenadas del punto indicador en arco circular (radio = 12.5, centro = 18, 18)
  const r = 12.5;
  const cx = 18;
  const cy = 18;
  const endRad = ((angle - 90) * Math.PI) / 180;
  const dotX = cx + r * Math.cos(endRad);
  const dotY = cy + r * Math.sin(endRad);

  return (
    <div
      aria-label={ariaLabel}
      className="dsp-rotary-knob-container"
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      title="Gire hacia arriba o hacia abajo para sintonizar la frecuencia central. Doble clic para restablecer."
    >
      <svg className="dsp-rotary-knob-svg" viewBox="0 0 36 36">
        {/* Pista de fondo (Arco 270 grados) */}
        <circle
          className="dsp-rotary-bg-track"
          cx={cx}
          cy={cy}
          r={r}
          strokeDasharray={`${(r * 2 * Math.PI * 270) / 360} ${(r * 2 * Math.PI * 90) / 360}`}
          strokeDashoffset={0}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Pista activa luminosa */}
        <circle
          className="dsp-rotary-active-track"
          cx={cx}
          cy={cy}
          r={r}
          strokeDasharray={`${(r * 2 * Math.PI * 270 * norm) / 360} ${(r * 2 * Math.PI)}`}
          strokeDashoffset={0}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Punto indicador de rotación */}
        <circle className="dsp-rotary-dot" cx={dotX} cy={dotY} r="3" />
      </svg>
    </div>
  );
}

interface DspEqualizerViewProps {
  isModal?: boolean;
  onClose?: () => void;
  isPlaying?: boolean;
}

export function DspEqualizerView({ isModal = false, onClose, isPlaying = false }: DspEqualizerViewProps) {
  const dsp = useDspController();
  const isVisualizerActive = dsp.enabled && isPlaying;
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // Modo alternable de vista izquierda (Efectos DSP vs Controles Maestros)
  const [isMasterControlsView, setIsMasterControlsView] = useState(false);
  const [bandCount, setBandCount] = useState<number>(10);
  const [volumeLeveling, setVolumeLeveling] = useState<number>(0.0);
  const [filterQ, setFilterQ] = useState<number>(1.0);
  const [balance, setBalance] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const gradientId = useId();

  // SVG Equalizer dimensions
  const svgWidth = 1000;
  const svgHeight = 360;
  const paddingX = 48;
  const paddingY = 32;
  const drawWidth = svgWidth - paddingX * 2;
  const drawHeight = svgHeight - paddingY * 2;
  const zeroY = paddingY + drawHeight / 2;

  // Map 10 bands to SVG Coordinates (x, y) reflejando la respuesta paramétrica 2D (Frecuencia libre + Ganancia compuesta)
  const points = useMemo(() => {
    const step = drawWidth / (EQ_FREQUENCIES.length - 1);
    const bass = dsp.effects.bassBoost;
    const clarity = dsp.effects.clarity;

    return dsp.bands.map((baseGainDb, index) => {
      const freq = dsp.frequencies[index] ?? EQ_FREQUENCIES[index];
      const range = EQ_BAND_RANGES[index] || [20, 20000];
      const minF = range[0];
      const maxF = range[1];
      const freqRatio = Math.max(0, Math.min(1, (freq - minF) / (maxF - minF || 1)));

      const columnCenterX = paddingX + index * step;
      const xOffset = (freqRatio - 0.5) * (step * 0.55);
      const x = columnCenterX + xOffset;

      // Contribución acústica de los filtros DSP a cada banda
      let effectGain = 0;
      if (index === 0) effectGain = bass * 0.35;        // Subgraves
      else if (index === 1) effectGain = bass * 0.30;   // Graves
      else if (index === 2) effectGain = bass * 0.18;   // Graves medios
      else if (index === 3) effectGain = bass * 0.06;   // Medios bajos
      else if (index === 6) effectGain = clarity * 0.08; // Presencia vocal
      else if (index === 7) effectGain = clarity * 0.15; // Medios altos
      else if (index === 8) effectGain = clarity * 0.28; // Agudos
      else if (index === 9) effectGain = clarity * 0.38; // Aire

      const totalGain = Math.max(-12, Math.min(12, baseGainDb + effectGain));
      const y = zeroY - (totalGain / 12) * (drawHeight / 2);

      return {
        x,
        y,
        gainDb: baseGainDb,
        effectiveGainDb: totalGain,
        effectGain,
        index,
        freq,
        minFreq: minF,
        maxFreq: maxF,
        columnCenterX,
      };
    });
  }, [dsp.bands, dsp.frequencies, dsp.effects.bassBoost, dsp.effects.clarity, drawWidth, drawHeight, zeroY, paddingX]);

  // Generate smooth cubic bezier spline SVG path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" };

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = svgHeight - paddingY + 10;
    const area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { linePath: d, areaPath: area };
  }, [points, svgHeight, paddingY]);

  // Handle Dragging Nodes on SVG (2D: Vertical Gain dB & Horizontal Frequency Hz)
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDraggingIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIndex === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const clientX = e.clientX - rect.left;
    const relativeY = clientY - paddingY;
    const normalizedY = 1 - (relativeY / drawHeight);
    const targetTotalDb = (normalizedY - 0.5) * 24; // -12 to +12 dB
    const point = points[draggingIndex];
    const effectGain = point ? point.effectGain : 0;
    const targetGain = Math.max(-12, Math.min(12, targetTotalDb - effectGain));

    // Horizontal Frequency Calculation
    const step = drawWidth / (EQ_FREQUENCIES.length - 1);
    const colCenter = point ? point.columnCenterX : paddingX + draggingIndex * step;
    const halfWidth = step * 0.45;
    const relX = clientX - colCenter;
    const freqRatio = Math.max(0, Math.min(1, (relX + halfWidth) / (halfWidth * 2)));
    const minF = point ? point.minFreq : 20;
    const maxF = point ? point.maxFreq : 20000;
    const targetFreq = Math.round(minF + freqRatio * (maxF - minF));

    dsp.setBandParametric(draggingIndex, targetFreq, targetGain);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIndex !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
      setDraggingIndex(null);
    }
  };

  const activeDevice = dsp.devices.find((d) => d.name === dsp.selectedDevice) || dsp.devices[0];
  const activePreset = dsp.allPresets.find((p) => p.id === dsp.activePresetId);

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    dsp.saveCustomPreset(newPresetName);
    setNewPresetName("");
    setIsSavingPreset(false);
  };

  const formatFreq = (f: number) =>
    f >= 1000 ? `${(f / 1000).toFixed(f % 1000 === 0 ? 0 : 2)} kHz` : `${Math.round(f)} Hz`;

  return (
    <div className={`dsp-equalizer-root ${isModal ? "dsp-equalizer-modal-mode" : "dsp-equalizer-full-mode"}`}>
      {/* ── Top Bar / Header ── */}
      <div className="dsp-header">
        <div className="dsp-title-area">
          <h1>Ecualizador & DSP de Audio</h1>
          <p>Motor de mejora acústica y procesamiento armónico en tiempo real</p>
        </div>

        <div className="dsp-header-controls">
          {/* Selector de Presets */}
          <div className="dsp-dropdown-container">
            <button
              className="dsp-dropdown-trigger"
              onClick={() => {
                setIsPresetMenuOpen((prev) => !prev);
                setIsDeviceMenuOpen(false);
              }}
              type="button"
            >
              <Icon name="music" />
              <span className="dsp-dropdown-label">{activePreset ? activePreset.name : "Personalizado"}</span>
              <Icon name="chevronDown" />
            </button>

            {isPresetMenuOpen && (
              <div className="dsp-dropdown-menu">
                <div className="dsp-dropdown-header">Presets Acústicos</div>
                <div className="dsp-dropdown-list">
                  {dsp.allPresets.map((preset) => (
                    <button
                      className={`dsp-dropdown-item ${dsp.activePresetId === preset.id ? "active" : ""}`}
                      key={preset.id}
                      onClick={() => {
                        dsp.applyPreset(preset);
                        setIsPresetMenuOpen(false);
                      }}
                      type="button"
                    >
                      <span className="dsp-preset-name">{preset.name}</span>
                      {preset.isBuiltIn && <span className="dsp-builtin-badge">Stock</span>}
                      {!preset.isBuiltIn && (
                        <button
                          className="dsp-delete-preset-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            dsp.deleteCustomPreset(preset.id);
                          }}
                          title="Eliminar preset"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </button>
                  ))}
                </div>
                <div className="dsp-dropdown-footer">
                  {!isSavingPreset ? (
                    <button
                      className="dsp-action-link"
                      onClick={() => setIsSavingPreset(true)}
                      type="button"
                    >
                      + Guardar como nuevo preset...
                    </button>
                  ) : (
                    <form className="dsp-save-preset-form" onSubmit={handleSavePresetSubmit}>
                      <input
                        autoFocus
                        className="dsp-preset-input"
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Nombre del preset..."
                        type="text"
                        value={newPresetName}
                      />
                      <button className="dsp-save-confirm-btn" type="submit">
                        Guardar
                      </button>
                      <button
                        className="dsp-save-cancel-btn"
                        onClick={() => setIsSavingPreset(false)}
                        type="button"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selector de Dispositivo de Salida de Audio */}
          <div className="dsp-dropdown-container">
            <button
              className="dsp-dropdown-trigger dsp-device-trigger"
              onClick={() => {
                setIsDeviceMenuOpen((prev) => !prev);
                setIsPresetMenuOpen(false);
              }}
              type="button"
            >
              <Icon name="volume" />
              <span className="dsp-dropdown-label dsp-device-label">
                {activeDevice ? activeDevice.description : "Dispositivo de audio"}
              </span>
              <Icon name="chevronDown" />
            </button>

            {isDeviceMenuOpen && (
              <div className="dsp-dropdown-menu dsp-device-menu">
                <div className="dsp-dropdown-header">Dispositivo de Salida (Windows)</div>
                <div className="dsp-dropdown-list">
                  {dsp.devices.map((dev) => (
                    <button
                      className={`dsp-dropdown-item ${dev.name === dsp.selectedDevice ? "active" : ""}`}
                      key={dev.name}
                      onClick={() => {
                        void dsp.selectAudioDevice(dev.name);
                        setIsDeviceMenuOpen(false);
                      }}
                      type="button"
                    >
                      <span className="dsp-device-item-name">{dev.description}</span>
                      {dev.name === dsp.selectedDevice && <span className="dsp-check-badge">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botón Power Maestro (Bypass) */}
          <button
            className={`dsp-power-btn ${dsp.enabled ? "on" : "off"}`}
            onClick={dsp.toggleEnabled}
            title={dsp.enabled ? "Desactivar DSP (Bypass)" : "Activar DSP"}
            type="button"
          >
            <span className="dsp-power-indicator" />
            <span>{dsp.enabled ? "POWER ON" : "BYPASS"}</span>
          </button>

          {/* Botón Cerrar si es Modal */}
          {isModal && onClose && (
            <button className="dsp-modal-close-btn" onClick={onClose} type="button">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Top Spectrum Visualizer Animation (Curva Orgánica Dinámica) ── */}
      <div className={`dsp-visualizer-bar ${isVisualizerActive ? "active" : "inactive"}`}>
        {SPECTRUM_BARS.map((bar) => (
          <div
            className={`dsp-viz-column ${bar.animType}`}
            key={bar.id}
            style={
              {
                "--peak-h": `${bar.peakPct}%`,
                "--min-h": `${bar.minPct}%`,
                "--anim-dur": `${bar.dur}s`,
                "--anim-delay": `${bar.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* ── Main DSP Workbench Layout ── */}
      <div className={`dsp-workbench-grid ${dsp.enabled ? "" : "dsp-disabled"}`}>
        {/* ── Left Column: DSP Effects / Master Controls (Alternables con ⇄) ── */}
        <div className="dsp-effects-card">
          <div className="dsp-card-header">
            <h3>{isMasterControlsView ? "Controles Maestros" : "Efectos DSP"}</h3>
            <div className="dsp-card-header-actions">
              <button
                className="dsp-flip-view-btn"
                onClick={() => setIsMasterControlsView((prev) => !prev)}
                title={isMasterControlsView ? "Ver Efectos DSP (Claridad, Graves, etc.)" : "Ver Controles Maestros (Volumen, Q, Balance)"}
                type="button"
              >
                ⇄
              </button>
            </div>
          </div>

          {!isMasterControlsView ? (
            <div className="dsp-effects-list">
              {/* 1. Claridad */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="sparkles" /> Claridad
                  </span>
                  <span className="dsp-effect-val-pill">{dsp.effects.clarity}</span>
                </div>
                <input
                  className="dsp-slider dsp-clarity-slider"
                  max={10}
                  min={0}
                  onChange={(e) => dsp.setEffectValue("clarity", parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.effects.clarity}
                />
                <span className="dsp-effect-desc">Realza armónicos agudos y nitidez vocal</span>
              </div>

              {/* 2. Ambiente */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="library" /> Ambiente
                  </span>
                  <span className="dsp-effect-val-pill">{dsp.effects.ambience}</span>
                </div>
                <input
                  className="dsp-slider dsp-ambience-slider"
                  max={10}
                  min={0}
                  onChange={(e) => dsp.setEffectValue("ambience", parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.effects.ambience}
                />
                <span className="dsp-effect-desc">Acústica de sala y profundidad espacial</span>
              </div>

              {/* 3. Sonido Envolvente */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="volume" /> Sonido Envolvente
                  </span>
                  <span className="dsp-effect-val-pill">{dsp.effects.surround}</span>
                </div>
                <input
                  className="dsp-slider dsp-surround-slider"
                  max={10}
                  min={0}
                  onChange={(e) => dsp.setEffectValue("surround", parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.effects.surround}
                />
                <span className="dsp-effect-desc">Expansión estéreo panorámica 3D</span>
              </div>

              {/* 4. Refuerzo Dinámico */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="pulse" /> Refuerzo Dinámico
                  </span>
                  <span className="dsp-effect-val-pill">{dsp.effects.dynamicBoost}</span>
                </div>
                <input
                  className="dsp-slider dsp-dynamic-slider"
                  max={10}
                  min={0}
                  onChange={(e) => dsp.setEffectValue("dynamicBoost", parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.effects.dynamicBoost}
                />
                <span className="dsp-effect-desc">Compresión equilibrada y ganancia sin saturación</span>
              </div>

              {/* 5. Refuerzo de Graves */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="waveform" /> Refuerzo de Graves
                  </span>
                  <span className="dsp-effect-val-pill">{dsp.effects.bassBoost}</span>
                </div>
                <input
                  className="dsp-slider dsp-bass-slider"
                  max={10}
                  min={0}
                  onChange={(e) => dsp.setEffectValue("bassBoost", parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.effects.bassBoost}
                />
                <span className="dsp-effect-desc">Pegada en frecuencias sub-graves (&lt; 90 Hz)</span>
              </div>
            </div>
          ) : (
            <div className="dsp-effects-list dsp-master-controls-list">
              {/* Selector de Bandas */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="list" /> Número de Bandas
                  </span>
                  <span className="dsp-effect-val-pill">{bandCount} bandas</span>
                </div>
                <select
                  className="dsp-band-count-select"
                  onChange={(e) => setBandCount(Number(e.target.value))}
                  value={bandCount}
                >
                  <option value={5}>5 bandas</option>
                  <option value={10}>10 bandas (Estándar)</option>
                  <option value={15}>15 bandas (Detalle)</option>
                  <option value={20}>20 bandas (Avanzado)</option>
                  <option value={31}>31 bandas (1/3 Octava)</option>
                </select>
                <span className="dsp-effect-desc">Resolución paramétrica del espectro de frecuencias</span>
              </div>

              {/* Volumen maestro */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="volume" /> Volumen maestro
                  </span>
                  <span className="dsp-effect-val-pill">
                    {dsp.preampDb > 0 ? `+${dsp.preampDb.toFixed(1)} dB` : `${dsp.preampDb.toFixed(1)} dB`}
                  </span>
                </div>
                <input
                  className="dsp-slider"
                  max={6}
                  min={-12}
                  onChange={(e) => dsp.setPreampDb(parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={dsp.preampDb}
                />
                <span className="dsp-effect-desc">Ganancia de salida del motor DSP</span>
              </div>

              {/* Nivelación de volumen */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="pulse" /> Nivelación de volumen
                  </span>
                  <span className="dsp-effect-val-pill">{volumeLeveling.toFixed(1)} dB</span>
                </div>
                <input
                  className="dsp-slider"
                  max={10}
                  min={0}
                  onChange={(e) => setVolumeLeveling(parseFloat(e.target.value))}
                  step={0.5}
                  type="range"
                  value={volumeLeveling}
                />
                <span className="dsp-effect-desc">Compensación automática de volumen entre pistas</span>
              </div>

              {/* Q del filtro */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="sparkles" /> Q del filtro
                  </span>
                  <span className="dsp-effect-val-pill">{filterQ.toFixed(1)}x</span>
                </div>
                <input
                  className="dsp-slider"
                  max={3}
                  min={0.5}
                  onChange={(e) => setFilterQ(parseFloat(e.target.value))}
                  step={0.1}
                  type="range"
                  value={filterQ}
                />
                <span className="dsp-effect-desc">Ancho de campana paramétrica de las bandas de ecualización</span>
              </div>

              {/* Balance L/R */}
              <div className="dsp-effect-row">
                <div className="dsp-effect-label-row">
                  <span className="dsp-effect-name">
                    <Icon name="folder" /> Balance
                  </span>
                  <span className="dsp-effect-val-pill">
                    {balance === 0 ? "Centro" : balance < 0 ? `L ${Math.abs(balance)}` : `R ${balance}`}
                  </span>
                </div>
                <input
                  className="dsp-slider"
                  max={10}
                  min={-10}
                  onChange={(e) => setBalance(parseFloat(e.target.value))}
                  step={1}
                  type="range"
                  value={balance}
                />
                <div className="dsp-balance-legend">
                  <span>Izquierda</span>
                  <span>Derecha</span>
                </div>
              </div>

              {/* Botón Reset / Deshacer */}
              <div className="dsp-master-reset-row">
                <button
                  className="dsp-master-reset-btn"
                  onClick={() => {
                    dsp.setPreampDb(-1.0);
                    setVolumeLeveling(0.0);
                    setFilterQ(1.0);
                    setBalance(0);
                  }}
                  title="Restablecer controles maestros a valores predeterminados"
                  type="button"
                >
                  ↶ Restablecer Controles
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: 10-Band Parametric Spline Equalizer ── */}
        <div className="dsp-equalizer-card">
          <div className="dsp-card-header">
            <div>
              <h3>Ecualizador Gráfico Paramétrico</h3>
              <p className="dsp-card-subtitle">10 Bandas con interpolación Spline Bezier ($Q = 1.527$)</p>
            </div>
            <div className="dsp-eq-actions">
              <button
                className="dsp-flat-btn"
                onClick={dsp.resetToFlat}
                title="Restablecer todas las bandas a 0 dB"
                type="button"
              >
                Reset Plano
              </button>
            </div>
          </div>

          {/* Interactive Spline Curve Canvas / SVG */}
          <div className="dsp-svg-canvas-wrapper">
            <svg
              className="dsp-svg-canvas"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines (-12dB, -6dB, 0dB, +6dB, +12dB) */}
              <line className="dsp-grid-line" x1={paddingX} x2={svgWidth - paddingX} y1={paddingY} y2={paddingY} />
              <line className="dsp-grid-line" x1={paddingX} x2={svgWidth - paddingX} y1={paddingY + drawHeight * 0.25} y2={paddingY + drawHeight * 0.25} />
              <line className="dsp-grid-zero-line" x1={paddingX} x2={svgWidth - paddingX} y1={zeroY} y2={zeroY} />
              <line className="dsp-grid-line" x1={paddingX} x2={svgWidth - paddingX} y1={paddingY + drawHeight * 0.75} y2={paddingY + drawHeight * 0.75} />
              <line className="dsp-grid-line" x1={paddingX} x2={svgWidth - paddingX} y1={svgHeight - paddingY} y2={svgHeight - paddingY} />

              {/* dB Legend */}
              <text className="dsp-grid-label" x={paddingX - 10} y={paddingY + 4}>+12 dB</text>
              <text className="dsp-grid-label" x={paddingX - 10} y={zeroY + 4}>0 dB</text>
              <text className="dsp-grid-label" x={paddingX - 10} y={svgHeight - paddingY + 4}>-12 dB</text>

              {/* Vertical Frequency Guidelines */}
              {points.map((p) => (
                <line
                  className="dsp-freq-guideline"
                  key={p.index}
                  x1={p.x}
                  x2={p.x}
                  y1={paddingY}
                  y2={svgHeight - paddingY}
                />
              ))}

              {/* Spline Filled Area */}
              <path className="dsp-spline-area" d={areaPath} fill={`url(#${gradientId})`} />

              {/* Spline Glowing Line */}
              <path className="dsp-spline-line" d={linePath} />

              {/* Draggable Frequency Nodes */}
              {points.map((p) => (
                <g className="dsp-node-group" key={p.index} transform={`translate(${p.x}, ${p.y})`}>
                  <circle className="dsp-node-outer-glow" r="14" />
                  <circle
                    className={`dsp-node-circle ${draggingIndex === p.index ? "dragging" : ""}`}
                    onPointerDown={(e) => handlePointerDown(p.index, e)}
                    r="7"
                  />
                  {/* Gain Tooltip above node */}
                  <text className="dsp-node-text" dy="-12">
                    {p.effectiveGainDb > 0 ? `+${p.effectiveGainDb.toFixed(1)}` : p.effectiveGainDb.toFixed(1)}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* 10 Band Rotary Knobs Underneath */}
          <div className="dsp-bands-knob-row">
            {points.map((p) => (
              <div className="dsp-band-column" key={p.index}>
                <span className="dsp-band-freq-label">{formatFreq(p.freq)}</span>
                <DspRotaryKnob
                  ariaLabel={`Frecuencia para banda ${formatFreq(p.freq)}`}
                  defaultValue={EQ_FREQUENCIES[p.index]}
                  max={p.maxFreq}
                  min={p.minFreq}
                  onChange={(newF) => dsp.setBandFrequency(p.index, newF)}
                  value={p.freq}
                />
                <span className={`dsp-band-gain-badge ${p.effectiveGainDb !== 0 ? "active" : ""}`}>
                  {p.effectiveGainDb > 0 ? `+${p.effectiveGainDb.toFixed(1)}` : p.effectiveGainDb.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

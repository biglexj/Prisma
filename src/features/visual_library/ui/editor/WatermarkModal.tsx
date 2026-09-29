import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
import type { WatermarkConfig, WatermarkLogoPlacement, WatermarkPosition } from "../../model/watermark";
import "./watermark-modal.css";

interface WatermarkModalProps {
  config: WatermarkConfig;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newConfig: WatermarkConfig) => void;
}

const LOGO_PATTERN = /\.(png|webp|jpe?g|svg)$/i;
const LOGO_PLACEMENTS: { id: WatermarkLogoPlacement; label: string }[] = [
  { id: "above", label: "Arriba" }, { id: "below", label: "Abajo" },
  { id: "left", label: "Izquierda" }, { id: "right", label: "Derecha" },
  { id: "overlay", label: "Texto encima" },
];
const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: "top-left", label: "Sup. Izq." }, { id: "top-right", label: "Sup. Der." },
  { id: "center", label: "Centro" }, { id: "bottom-left", label: "Inf. Izq." },
  { id: "bottom-right", label: "Inf. Der." },
];

export function WatermarkModal({ config, isOpen, onClose, onApply }: WatermarkModalProps) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [text, setText] = useState(config.text);
  const [includeDate, setIncludeDate] = useState(config.includeDate);
  const [logoPath, setLogoPath] = useState<string | null>(config.logoPath ?? null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(config.logoDataUrl ?? null);
  const [logoScale, setLogoScale] = useState(config.logoScale ?? 0.45);
  const [logoPlacement, setLogoPlacement] = useState<WatermarkLogoPlacement>(config.logoPlacement ?? "above");
  const [position, setPosition] = useState<WatermarkPosition>(config.position);
  const [scale, setScale] = useState(config.scale);
  const [opacity, setOpacity] = useState(config.opacity);
  const [color, setColor] = useState(config.color);
  const [withShadow, setWithShadow] = useState(config.withShadow);
  const [withOutline, setWithOutline] = useState(config.withOutline ?? false);
  const [outlineColor, setOutlineColor] = useState(config.outlineColor ?? "#151014");
  const [outlineWidth, setOutlineWidth] = useState(config.outlineWidth ?? 6);
  const [isLogoDragOver, setIsLogoDragOver] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoDropRef = useRef<HTMLDivElement>(null);
  const nativeHoverRef = useRef(false);

  const acceptLogoPath = useCallback((path: string) => {
    if (!LOGO_PATTERN.test(path)) { setLogoError("Usa un archivo PNG, WebP, JPG o SVG."); return; }
    setLogoPath(path);
    setLogoDataUrl(toSafeAssetUrl(path));
    setLogoError("");
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const unlistens: UnlistenFn[] = [];
    let cancelled = false;
    const updateHover = (point?: { x: number; y: number }) => {
      if (!point || !logoDropRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const x = point.x / dpr;
      const y = point.y / dpr;
      const rect = logoDropRef.current.getBoundingClientRect();
      const over = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      nativeHoverRef.current = over;
      setIsLogoDragOver(over);
    };
    const dropPaths = (paths?: string[], point?: { x: number; y: number }) => {
      if (point) updateHover(point);
      const over = nativeHoverRef.current;
      nativeHoverRef.current = false;
      setIsLogoDragOver(false);
      if (over && paths?.[0]) acceptLogoPath(paths[0]);
    };
    const leave = () => { nativeHoverRef.current = false; setIsLogoDragOver(false); };
    const register = (promise: Promise<UnlistenFn>) => {
      promise.then((unlisten) => cancelled ? unlisten() : unlistens.push(unlisten)).catch(() => {});
    };
    try {
      register(getCurrentWebview().onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "enter" || event.payload.type === "over") updateHover(event.payload.position);
        if (event.payload.type === "drop") dropPaths(event.payload.paths);
        if (event.payload.type === "leave") leave();
      }));
    } catch {}
    register(listen<{ paths?: string[]; position?: { x: number; y: number } }>("prisma://native-drag-drop", (event) => {
      if (!cancelled) dropPaths(event.payload?.paths, event.payload?.position);
    }));
    register(listen<{ position?: { x: number; y: number } }>("prisma://native-drag-over", (event) => {
      if (!cancelled) updateHover(event.payload?.position);
    }));
    register(listen("prisma://native-drag-leave", () => { if (!cancelled) leave(); }));
    return () => { cancelled = true; unlistens.forEach((unlisten) => unlisten()); };
  }, [acceptLogoPath, isOpen]);

  if (!isOpen) return null;

  const handlePickLogo = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Logotipos e imágenes", extensions: ["png", "webp", "jpg", "jpeg", "svg"] }] });
      if (typeof selected === "string") acceptLogoPath(selected);
    } catch (error) { console.warn("[WatermarkModal] Error seleccionando archivo de logo:", error); }
  };
  const handleHtmlDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsLogoDragOver(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const path = (file as File & { path?: string }).path;
    if (path) acceptLogoPath(path);
    else if (LOGO_PATTERN.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => { setLogoPath(file.name); setLogoDataUrl(String(reader.result)); setLogoError(""); setEnabled(true); };
      reader.onerror = () => setLogoError("No se pudo leer el logotipo.");
      reader.readAsDataURL(file);
    } else setLogoError("Usa un archivo PNG, WebP, JPG o SVG.");
  };
  const handleConfirm = () => {
    onApply({ ...config, enabled, text: text.trim(), includeDate, logoPath, logoDataUrl, logoScale, logoPlacement,
      position, scale, opacity, color, withShadow, withOutline, outlineColor, outlineWidth });
    onClose();
  };

  return (
    <div className="media-dialog-backdrop" onClick={onClose} role="presentation">
      <div className="media-dialog-card watermark-modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="watermark-modal-title">
        <header className="watermark-modal-header">
          <div className="watermark-modal-title">
            <span className="media-dialog-icon"><Icon name="crop" /></span>
            <div><h3 id="watermark-modal-title">Marca de agua</h3><p>Combina logotipo, firma y estilo en tu imagen</p></div>
          </div>
          <button type="button" className="watermark-modal-close" onClick={onClose} title="Cerrar"><Icon name="close" /></button>
        </header>
        <div className="watermark-modal-body">
          <div className="watermark-modal-column">
            <label className="watermark-toggle-row">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <span className="watermark-toggle-label"><strong>Activar marca de agua</strong><small>Visible en la vista previa y al exportar</small></span>
            </label>
            <div className="watermark-field-group">
              <label className="watermark-label" htmlFor="watermark-author">Texto o autoría</label>
              <input id="watermark-author" type="text" className="watermark-text-input" placeholder="Ej. © biglexj / Fotografía" value={text}
                onChange={(event) => { setText(event.target.value); if (event.target.value.trim()) setEnabled(true); }} />
            </div>
            <label className="watermark-checkbox-row">
              <input type="checkbox" checked={includeDate} onChange={(event) => { setIncludeDate(event.target.checked); if (event.target.checked) setEnabled(true); }} />
              <span>Incluir fecha actual (año-mes-día)</span>
            </label>
            <div className="watermark-field-group">
              <span className="watermark-label">Logotipo</span>
              <div ref={logoDropRef} className={`watermark-logo-drop ${isLogoDragOver ? "is-drag-over" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setIsLogoDragOver(true); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsLogoDragOver(true); }}
                onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsLogoDragOver(false); }}
                onDrop={handleHtmlDrop}>
                {logoDataUrl && <div className="watermark-logo-preview">
                  <img src={logoDataUrl} alt="Logotipo seleccionado" />
                  <button type="button" className="watermark-logo-remove-btn" onClick={() => { setLogoPath(null); setLogoDataUrl(null); }} title="Quitar logo"><Icon name="close" /></button>
                </div>}
                <div className="watermark-logo-drop-actions">
                  <span>{isLogoDragOver ? "Suelta el logotipo aquí" : "Arrastra un PNG, WebP, JPG o SVG aquí"}</span>
                  <button type="button" className="watermark-logo-pick-btn" onClick={() => void handlePickLogo()}>
                    <Icon name="folder-open" /><span>{logoDataUrl ? "Cambiar archivo" : "Elegir archivo"}</span>
                  </button>
                </div>
              </div>
              {logoError && <small className="watermark-logo-error" role="alert">{logoError}</small>}
            </div>
            {logoDataUrl && <div className="watermark-logo-controls">
              <div className="watermark-slider-header"><label className="watermark-label" htmlFor="watermark-logo-size">Tamaño del logotipo</label><span>{Math.round(logoScale * 100)}%</span></div>
              <input id="watermark-logo-size" type="range" min="0.1" max="1.5" step="0.05" value={logoScale} onChange={(event) => setLogoScale(parseFloat(event.target.value))} className="watermark-slider" />
              {(text.trim() || includeDate) && <>
                <span className="watermark-label">Logo respecto al texto</span>
                <div className="watermark-logo-layout-grid">{LOGO_PLACEMENTS.map((choice) => (
                  <button key={choice.id} type="button" className={`watermark-pos-btn ${logoPlacement === choice.id ? "is-selected" : ""}`} onClick={() => setLogoPlacement(choice.id)}>{choice.label}</button>
                ))}</div>
              </>}
            </div>}
          </div>

          <div className="watermark-modal-column">
            <div className="watermark-field-group">
              <span className="watermark-label">Ubicación en la imagen</span>
              <div className="watermark-position-grid">{POSITIONS.map((choice) => (
                <button key={choice.id} type="button" className={`watermark-pos-btn ${position === choice.id ? "is-selected" : ""}`} onClick={() => setPosition(choice.id)}>{choice.label}</button>
              ))}</div>
              <small className="watermark-position-help">Margen de 1 %. Después de aplicar puedes arrastrar la marca sobre la imagen.{position === "custom" ? " Ubicación libre seleccionada." : ""}</small>
            </div>
            <div className="watermark-sliders-grid">
              <div className="watermark-field-group">
                <div className="watermark-slider-header"><label className="watermark-label" htmlFor="watermark-text-size">Tamaño del texto</label><span>{Math.round(scale * 100)}%</span></div>
                <input id="watermark-text-size" type="range" min="0.4" max="2.5" step="0.05" value={scale} onChange={(event) => setScale(parseFloat(event.target.value))} className="watermark-slider" />
              </div>
              <div className="watermark-field-group">
                <div className="watermark-slider-header"><label className="watermark-label" htmlFor="watermark-opacity">Opacidad</label><span>{Math.round(opacity * 100)}%</span></div>
                <input id="watermark-opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(parseFloat(event.target.value))} className="watermark-slider" />
              </div>
            </div>
            <div className="watermark-style-box">
              <span className="watermark-label">Color y efectos</span>
              <div className="watermark-color-row">
                <label htmlFor="watermark-text-color">Color del texto</label>
                <input id="watermark-text-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
                <span>{color.toUpperCase()}</span>
              </div>
              <label className="watermark-checkbox-row"><input type="checkbox" checked={withOutline} onChange={(event) => setWithOutline(event.target.checked)} /><span>Contorno de texto y logo</span></label>
              {withOutline && <div className="watermark-outline-controls">
                <div className="watermark-color-row">
                  <label htmlFor="watermark-outline-color">Color del contorno</label>
                  <input id="watermark-outline-color" type="color" value={outlineColor} onChange={(event) => setOutlineColor(event.target.value)} />
                  <span>{outlineColor.toUpperCase()}</span>
                </div>
                <div className="watermark-slider-header"><label className="watermark-label" htmlFor="watermark-outline-width">Grosor del borde</label><span>{outlineWidth}%</span></div>
                <input id="watermark-outline-width" type="range" min="1" max="12" step="1" value={outlineWidth} onChange={(event) => setOutlineWidth(Number(event.target.value))} className="watermark-slider" />
              </div>}
              <label className="watermark-checkbox-row"><input type="checkbox" checked={withShadow} onChange={(event) => setWithShadow(event.target.checked)} /><span>Sombra de contraste</span></label>
            </div>
          </div>
        </div>
        <footer className="watermark-modal-footer">
          {enabled && <button type="button" className="text-button watermark-disable-btn" onClick={() => { onApply({ ...config, enabled: false }); onClose(); }}>Desactivar marca</button>}
          <div className="watermark-footer-actions">
            <button type="button" className="text-button" onClick={onClose}>Cancelar</button>
            <button type="button" className="watermark-apply-btn" onClick={handleConfirm}>Aplicar cambios</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

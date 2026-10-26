import { useEffect, useRef } from "react";
import { Icon, type IconName } from "../../../../shared/ui/Icon";
import type { CaptureIntent, CaptureMode } from "../../model/types";

const modes: { id: CaptureMode; label: string; icon: IconName; shortcut: string }[] = [
  { id: "rect", label: "Rectángulo", icon: "crop", shortcut: "R" },
  { id: "window", label: "Ventana", icon: "columns", shortcut: "V" },
  { id: "fullscreen", label: "Pantalla completa", icon: "fullscreen", shortcut: "F" },
  { id: "freeform", label: "Forma libre", icon: "lasso", shortcut: "Q" },
];

type Props = {
  intent: CaptureIntent;
  mode: CaptureMode;
  disabled: boolean;
  onIntentChange: (intent: CaptureIntent) => void;
  onModeChange: (mode: CaptureMode) => void;
  onCancel: () => void;
};

export function CaptureSelectionBar({ intent, mode, disabled, onIntentChange, onModeChange, onCancel }: Props) {
  const picker = useRef<HTMLDetailsElement>(null);
  const selected = modes.find((option) => option.id === mode) ?? modes[0];
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target) && picker.current) picker.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => { if (picker.current) picker.current.open = false; }, [intent, mode, disabled]);

  return <div className="capture-floating-toolbar capture-selection-bar" role="toolbar" aria-label="Selector de captura"
    onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (event.key === "Escape" && picker.current?.open) {
        event.preventDefault(); event.stopPropagation(); picker.current.open = false;
        picker.current.querySelector("summary")?.focus();
      }
    }}>
    <div className="capture-intent-pill" role="group" aria-label="Tipo de captura">
      {(["image", "video"] as const).map((value) => <button key={value} type="button"
        className={`capture-mode-btn capture-icon-btn ${intent === value ? "is-active" : ""}`}
        aria-label={value === "image" ? "Capturar imagen" : "Grabar vídeo"}
        title={value === "image" ? "Capturar imagen" : "Grabar vídeo"}
        aria-pressed={intent === value} disabled={disabled} onClick={() => onIntentChange(value)}>
        <Icon name={value === "image" ? "camera" : "video"} width={18} height={18} />
      </button>)}
    </div>
    <div className="capture-pill-divider" />
    <details ref={picker} className="capture-mode-picker" onToggle={() => {
      if (disabled && picker.current) picker.current.open = false;
    }}>
      <summary className="capture-mode-btn" aria-label={`Tipo de recorte: ${selected.label}`} aria-disabled={disabled}
        title={`Tipo de recorte: ${selected.label}`} onClick={(event) => { if (disabled) event.preventDefault(); }}>
        <Icon name={selected.icon} width={18} height={18} /><Icon name="chevron-down" width={12} height={12} />
      </summary>
      <div className="capture-mode-menu" role="group" aria-label="Tipos de recorte">
        {modes.filter((option) => intent !== "video" || option.id !== "freeform").map((option) => <button
          key={option.id} type="button" className={`capture-mode-option ${mode === option.id ? "is-active" : ""}`}
          aria-label={option.label} title={`${option.label} (${option.shortcut})`}
          aria-pressed={mode === option.id} disabled={disabled} onClick={() => {
            onModeChange(option.id);
            if (picker.current) { picker.current.open = false; picker.current.querySelector("summary")?.focus(); }
          }}>
          <Icon name={option.icon} width={17} height={17} /><span>{option.label}</span><kbd>{option.shortcut}</kbd>
        </button>)}
      </div>
    </details>
    {intent === "image" && <button type="button" className={`capture-mode-btn capture-icon-btn ${mode === "eyedropper" ? "is-active" : ""}`}
      disabled={disabled} aria-label="Selector de color" aria-pressed={mode === "eyedropper"} title="Selector de color (C)"
      onClick={() => onModeChange("eyedropper")}><Icon name="pipette" width={18} height={18} /></button>}
    <div className="capture-pill-divider" />
    <button type="button" className="capture-mode-btn capture-icon-btn is-cancel" onClick={onCancel}
      aria-label="Cancelar captura" title="Cancelar captura (Esc)"><Icon name="close" width={18} height={18} /></button>
  </div>;
}

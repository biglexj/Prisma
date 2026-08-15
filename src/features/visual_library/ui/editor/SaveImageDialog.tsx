import { useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import type { ImageEditorSaveOptions } from "./editorTypes";

interface SaveImageDialogProps {
  originalFileName: string;
  onConfirm: (options: ImageEditorSaveOptions) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function SaveImageDialog({
  originalFileName,
  onConfirm,
  onCancel,
  isSaving,
}: SaveImageDialogProps) {
  const lastDot = originalFileName.lastIndexOf(".");
  const stem = lastDot > 0 ? originalFileName.substring(0, lastDot) : originalFileName;
  const ext = lastDot > 0 ? originalFileName.substring(lastDot) : ".png";

  const [overwrite, setOverwrite] = useState(false);
  const [copyName, setCopyName] = useState(`${stem}_editado`);

  const handleSave = () => {
    onConfirm({
      overwrite,
      customFileName: overwrite ? originalFileName : `${copyName.trim() || `${stem}_editado`}${ext}`,
    });
  };

  return (
    <div className="media-dialog-backdrop" onClick={isSaving ? undefined : onCancel} role="presentation">
      <div
        className="media-dialog-card image-editor-save-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <span className="media-dialog-icon">
          <Icon name="save" />
        </span>
        <h3>Guardar imagen editada</h3>
        <p className="media-dialog-message">
          Elige cómo deseas almacenar los cambios en tu disco:
        </p>

        <div className="editor-save-options">
          <label
            className={`editor-save-option-card ${!overwrite ? "is-selected" : ""}`}
            onClick={() => setOverwrite(false)}
          >
            <input
              type="radio"
              name="save_mode"
              checked={!overwrite}
              onChange={() => setOverwrite(false)}
            />
            <div className="editor-save-option-text">
              <strong>Guardar como nueva copia</strong>
              <span>Crea un archivo nuevo conservando el original intacto.</span>
            </div>
          </label>

          {!overwrite && (
            <div className="editor-save-filename-field">
              <span className="editor-save-field-label">Nombre de la copia:</span>
              <div className="media-rename-input-wrap">
                <input
                  type="text"
                  className="media-rename-input"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="Nombre de la copia"
                  disabled={isSaving}
                />
                <span className="media-rename-ext-badge">{ext}</span>
              </div>
            </div>
          )}

          <label
            className={`editor-save-option-card is-overwrite ${overwrite ? "is-selected" : ""}`}
            onClick={() => setOverwrite(true)}
          >
            <input
              type="radio"
              name="save_mode"
              checked={overwrite}
              onChange={() => setOverwrite(true)}
            />
            <div className="editor-save-option-text">
              <strong>Sobrescribir archivo original</strong>
              <span className="editor-save-warning-text">
                Reemplazará directamente el archivo "{originalFileName}".
              </span>
            </div>
          </label>
        </div>

        <div className="media-dialog-actions">
          <button
            type="button"
            className="media-dialog-cancel"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="media-dialog-confirm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import type { ImageEditorOutputFormat, ImageEditorSaveOptions } from "./editorTypes";
import { extensionForImageFormat, originalImageFormat } from "./saveImageFormat";

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
  const original = originalImageFormat(originalFileName);

  const [overwrite, setOverwrite] = useState(false);
  const [copyName, setCopyName] = useState(`${original.stem}_editado`);
  const [format, setFormat] = useState<ImageEditorOutputFormat>(original.format);
  const copyExtension = extensionForImageFormat(format, original.extension);

  const handleSave = () => {
    onConfirm({
      overwrite,
      customFileName: overwrite ? originalFileName : `${copyName.trim() || `${original.stem}_editado`}${copyExtension}`,
      format: overwrite ? original.format : format,
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
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  placeholder="Nombre de la copia"
                  disabled={isSaving}
                />
                <select
                  aria-label="Formato de la copia"
                  className="editor-save-format-select"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ImageEditorOutputFormat)}
                  disabled={isSaving}
                  title="Formato de la imagen nueva"
                >
                  <option value="png">PNG (.png)</option>
                  <option value="jpeg">JPEG ({original.extension === ".jpeg" ? ".jpeg" : ".jpg"})</option>
                  <option value="webp">WebP (.webp)</option>
                </select>
              </div>
            </div>
          )}

          <label
            className={`editor-save-option-card is-overwrite ${overwrite ? "is-selected" : ""} ${!original.canOverwrite ? "is-disabled" : ""}`}
            onClick={() => { if (original.canOverwrite) setOverwrite(true); }}
          >
            <input
              type="radio"
              name="save_mode"
              checked={overwrite}
              disabled={!original.canOverwrite || isSaving}
              onChange={() => setOverwrite(true)}
            />
            <div className="editor-save-option-text">
              <strong>Sobrescribir archivo original</strong>
              <span className="editor-save-warning-text">{original.canOverwrite
                ? `Reemplazará directamente "${originalFileName}" y conservará su formato.`
                : "Este formato original no puede sobrescribirse; guarda una copia en PNG, JPEG o WebP."}</span>
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

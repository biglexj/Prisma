import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import "./media-menu.css";

interface RenameMediaDialogProps {
  currentPath: string;
  currentTitle: string;
  onConfirm: (newName: string) => Promise<unknown> | void;
  onCancel: () => void;
}

export function RenameMediaDialog({
  currentPath,
  currentTitle,
  onConfirm,
  onCancel,
}: RenameMediaDialogProps) {
  // Extraer extensión y stem base
  const lastDot = currentTitle.lastIndexOf(".");
  const hasExt = lastDot > 0;
  const initialStem = hasExt ? currentTitle.substring(0, lastDot) : currentTitle;
  const ext = hasExt ? currentTitle.substring(lastDot) : "";

  const [name, setName] = useState(initialStem);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, isSubmitting]);

  const validate = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "El nombre no puede estar vacío";
    // Caracteres inválidos
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmed)) {
      return 'No se permiten caracteres especiales (< > : " / \\ | ? *)';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setName(nextVal);
    setError(validate(nextVal));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmed = name.trim();
    const finalName = ext ? `${trimmed}${ext}` : trimmed;
    if (finalName === currentTitle) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(finalName);
    } catch (err: any) {
      setError(err?.message || String(err) || "Error al renombrar el archivo");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="media-dialog-backdrop" onClick={isSubmitting ? undefined : onCancel} role="presentation">
      <div
        className="media-dialog-card media-rename-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
      >
        <span className="media-dialog-icon">
          <Icon name="edit" />
        </span>
        <h3 id="rename-dialog-title">Renombrar archivo</h3>
        <p className="media-dialog-message">
          Ingresa un nuevo nombre para <strong>{currentTitle}</strong>
        </p>

        <form onSubmit={handleSubmit} className="media-rename-form">
          <div className="media-rename-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="media-rename-input"
              value={name}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Nombre del archivo"
              spellCheck={false}
              autoComplete="off"
            />
            {ext && <span className="media-rename-ext-badge">{ext}</span>}
          </div>

          {error && (
            <div className="media-rename-error" role="alert">
              {error}
            </div>
          )}

          <div className="media-dialog-actions">
            <button
              type="button"
              className="media-dialog-cancel"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="media-dialog-confirm"
              disabled={isSubmitting || Boolean(error) || !name.trim()}
            >
              {isSubmitting ? "Guardando..." : "Renombrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

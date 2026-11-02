import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./media-menu.css";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: IconName;
  initialFocus?: "confirm" | "cancel";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  icon = "trash",
  initialFocus = "confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (initialFocus === "cancel" ? cancelRef : confirmRef).current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, initialFocus]);

  return (
    <div className="media-dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className="media-dialog-card"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="media-dialog-title"
      >
        <span className={`media-dialog-icon${danger ? " is-danger" : ""}`}>
          <Icon name={icon} />
        </span>
        <h3 id="media-dialog-title">{title}</h3>
        <div className="media-dialog-message">{message}</div>
        <div className="media-dialog-actions">
          <button className="media-dialog-cancel" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button
            className={`media-dialog-confirm${danger ? " is-danger" : ""}`}
            onClick={onConfirm}
            ref={confirmRef}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

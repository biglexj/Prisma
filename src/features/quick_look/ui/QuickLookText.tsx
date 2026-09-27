import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookTextProps {
  payload: QuickLookPayload;
  onEdit?: () => void;
}

export function QuickLookText({ payload, onEdit }: QuickLookTextProps) {
  const [copied, setCopied] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);
  const content = payload.textContent || "Archivo de texto vacío.";
  const lines = content.split("\n");

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="quicklook-text-container">
      <div className="quicklook-text-toolbar">
        <span className="quicklook-text-stats">
          {lines.length} {lines.length === 1 ? "línea" : "líneas"} • {content.length} caracteres
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            className={`quicklook-copy-btn ${isWrapped ? "is-active" : ""}`}
            onClick={() => setIsWrapped((w) => !w)}
            type="button"
            title={isWrapped ? "Desactivar ajuste automático de línea" : "Ajustar líneas al ancho de ventana"}
          >
            <Icon name="layout" />
            <span>{isWrapped ? "Ajuste activo" : "Ajuste de línea"}</span>
          </button>
          {onEdit && (
            <button
              className="quicklook-copy-btn quicklook-edit-btn"
              onClick={onEdit}
              type="button"
              title="Abrir editor completo en Prisma"
            >
              <Icon name="edit" />
              <span>Editar</span>
            </button>
          )}
          <button
            className={`quicklook-copy-btn ${copied ? "is-copied" : ""}`}
            onClick={handleCopy}
            type="button"
          >
            <Icon name={copied ? "check" : "copy"} />
            <span>{copied ? "Copiado" : "Copiar texto"}</span>
          </button>
        </div>
      </div>
      <div className={`quicklook-text-viewport ${isWrapped ? "is-wrapped" : ""}`}>
        <div className="quicklook-line-numbers" aria-hidden="true">
          {lines.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <pre className="quicklook-code-content">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}

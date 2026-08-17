import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookTextProps {
  payload: QuickLookPayload;
}

export function QuickLookText({ payload }: QuickLookTextProps) {
  const [copied, setCopied] = useState(false);
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
        <button
          className={`quicklook-copy-btn ${copied ? "is-copied" : ""}`}
          onClick={handleCopy}
          type="button"
        >
          <Icon name={copied ? "check" : "copy"} />
          <span>{copied ? "Copiado" : "Copiar texto"}</span>
        </button>
      </div>
      <div className="quicklook-text-viewport">
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

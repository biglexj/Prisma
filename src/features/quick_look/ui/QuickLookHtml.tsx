import { useEffect, useState } from "react";
import type { QuickLookPayload } from "../model/types";
import { Icon } from "../../../shared/ui/Icon";

interface QuickLookHtmlProps {
  payload: QuickLookPayload;
}

export function QuickLookHtml({ payload }: QuickLookHtmlProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  // Resetear al modo previa cada vez que cambia el archivo
  useEffect(() => {
    setViewMode("preview");
    setCopied(false);
  }, [payload.path]);

  const rawHtml = payload.textContent || "";
  const lines = rawHtml.split(/\r?\n/);

  // Inyectar scrollbar personalizado dentro del documento HTML aislado del iframe
  const SCROLLBAR_CSS = `<style>
    *{scrollbar-width:thin;scrollbar-color:rgba(208,188,255,0.45) transparent}
    *::-webkit-scrollbar{width:6px;height:6px}
    *::-webkit-scrollbar-track{background:transparent}
    *::-webkit-scrollbar-thumb{background:rgba(208,188,255,0.4);border-radius:9999px}
    *::-webkit-scrollbar-thumb:hover{background:rgba(208,188,255,0.75)}
  </style>`;

  const injectedHtml = rawHtml.includes("</head>")
    ? rawHtml.replace("</head>", `${SCROLLBAR_CSS}</head>`)
    : rawHtml.includes("<html")
      ? rawHtml.replace(/(<html[^>]*>)/i, `$1${SCROLLBAR_CSS}`)
      : `${SCROLLBAR_CSS}${rawHtml}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(rawHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="quicklook-markdown-container">
      {/* Barra superior estilo QuickLook estándar */}
      <div className="quicklook-md-toolbar">
        <div className="quicklook-md-tabs">
          <button
            className={`quicklook-md-tab ${viewMode === "preview" ? "is-active" : ""}`}
            onClick={() => setViewMode("preview")}
            type="button"
          >
            <Icon name="eye" />
            <span>Vista previa</span>
          </button>
          <button
            className={`quicklook-md-tab ${viewMode === "code" ? "is-active" : ""}`}
            onClick={() => setViewMode("code")}
            type="button"
          >
            <Icon name="code" />
            <span>Código fuente</span>
          </button>
        </div>

        <div className="quicklook-md-actions">
          <span className="quicklook-text-stats">
            {lines.length} {lines.length === 1 ? "línea" : "líneas"} • {rawHtml.length} caracteres
          </span>
          <button
            className={`quicklook-copy-btn ${copied ? "is-copied" : ""}`}
            onClick={handleCopy}
            type="button"
          >
            <Icon name={copied ? "check" : "copy"} />
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
        </div>
      </div>

      {/* Contenedor del documento */}
      {viewMode === "preview" ? (
        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#ffffff" }}>
          <iframe
            srcDoc={injectedHtml}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#ffffff",
              display: "block",
            }}
            title="Previsualización HTML"
          />
        </div>
      ) : (
        <div className="quicklook-text-viewport">
          <div className="quicklook-line-numbers" aria-hidden="true">
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <pre className="quicklook-code-content">
            <code>{rawHtml}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

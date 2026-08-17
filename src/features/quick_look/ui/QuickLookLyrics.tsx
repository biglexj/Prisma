import { useEffect, useMemo, useState } from "react";
import type { QuickLookPayload } from "../model/types";
import { Icon } from "../../../shared/ui/Icon";

interface QuickLookLyricsProps {
  payload: QuickLookPayload;
}

interface ParsedSubtitleLine {
  id: number;
  timeLabel?: string;
  text: string;
}

export function QuickLookLyrics({ payload }: QuickLookLyricsProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  // Resetear al modo principal cada vez que cambia el archivo
  useEffect(() => {
    setViewMode("rendered");
    setCopied(false);
  }, [payload.path]);

  const rawText = payload.textContent || "";
  const ext = payload.extension.toLowerCase();

  const lines = useMemo<ParsedSubtitleLine[]>(() => {
    if (!rawText.trim()) return [];

    const rawLines = rawText.split(/\r?\n/);
    const parsed: ParsedSubtitleLine[] = [];
    let idCounter = 1;

    if (ext === "lrc") {
      const timeRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^\[(ti|ar|al|by|offset):/i.test(trimmed)) continue;

        timeRegex.lastIndex = 0;
        const match = timeRegex.exec(trimmed);
        if (match) {
          const cleanText = trimmed.replace(timeRegex, "").trim();
          parsed.push({
            id: idCounter++,
            timeLabel: match[1],
            text: cleanText || "···",
          });
        } else {
          parsed.push({
            id: idCounter++,
            text: trimmed,
          });
        }
      }
    } else if (ext === "srt" || ext === "vtt") {
      let currentTimeLabel: string | undefined;
      let currentTextLines: string[] = [];

      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentTimeLabel && currentTextLines.length > 0) {
            parsed.push({
              id: idCounter++,
              timeLabel: currentTimeLabel,
              text: currentTextLines.join(" "),
            });
            currentTimeLabel = undefined;
            currentTextLines = [];
          }
          continue;
        }

        if (trimmed.includes("-->")) {
          currentTimeLabel = trimmed;
        } else if (/^\d+$/.test(trimmed) && !currentTimeLabel) {
          // Número de subtítulo, omitir
        } else if (currentTimeLabel) {
          currentTextLines.push(trimmed);
        } else if (trimmed.length > 0 && !trimmed.startsWith("WEBVTT")) {
          parsed.push({
            id: idCounter++,
            text: trimmed,
          });
        }
      }

      if (currentTimeLabel && currentTextLines.length > 0) {
        parsed.push({
          id: idCounter++,
          timeLabel: currentTimeLabel,
          text: currentTextLines.join(" "),
        });
      }
    } else {
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (trimmed) {
          parsed.push({ id: idCounter++, text: trimmed });
        }
      }
    }

    return parsed;
  }, [rawText, ext]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rawLines = rawText.split(/\r?\n/);

  return (
    <div className="quicklook-markdown-container">
      {/* Barra superior estilo QuickLook estándar */}
      <div className="quicklook-md-toolbar">
        <div className="quicklook-md-tabs">
          <button
            className={`quicklook-md-tab ${viewMode === "rendered" ? "is-active" : ""}`}
            onClick={() => setViewMode("rendered")}
            type="button"
          >
            <Icon name="music" />
            <span>Vista sincronizada</span>
          </button>
          <button
            className={`quicklook-md-tab ${viewMode === "raw" ? "is-active" : ""}`}
            onClick={() => setViewMode("raw")}
            type="button"
          >
            <Icon name="code" />
            <span>Texto fuente</span>
          </button>
        </div>

        <div className="quicklook-md-actions">
          <span className="quicklook-text-stats">
            {lines.length} {lines.length === 1 ? "frase" : "frases / subtítulos"} • {rawText.length} caracteres
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

      {/* Contenido */}
      {viewMode === "rendered" ? (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1.75rem",
            background: "var(--surface-container-low, #161220)",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          {lines.map((line) => (
            <div
              key={line.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.5rem 0.85rem",
                background: "var(--surface-container, #251f33)",
                borderRadius: "12px",
                border: "1px solid rgba(208, 188, 255, 0.08)",
              }}
            >
              {line.timeLabel ? (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "var(--primary, #d0bcff)",
                    background: "rgba(208, 188, 255, 0.12)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    flexShrink: 0,
                    marginTop: "1px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {line.timeLabel}
                </span>
              ) : null}
              <span
                style={{
                  fontSize: "0.94rem",
                  lineHeight: "1.45",
                  color: "var(--on-surface, #e6e1e5)",
                  flex: 1,
                }}
              >
                {line.text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="quicklook-text-viewport">
          <div className="quicklook-line-numbers" aria-hidden="true">
            {rawLines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <pre className="quicklook-code-content">
            <code>{rawText}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

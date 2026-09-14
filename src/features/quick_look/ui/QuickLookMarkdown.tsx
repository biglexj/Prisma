import { useMemo, useState } from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import "./quick-look-markdown.css";

interface QuickLookMarkdownProps {
  payload: QuickLookPayload;
}

function splitTableRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inBackticks = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === "\\") {
      if (i + 1 < row.length && row[i + 1] === "|") {
        current += "|";
        i++;
        continue;
      }
      current += "\\";
      continue;
    }
    if (char === "`") {
      inBackticks = !inBackticks;
      current += char;
      continue;
    }
    if (char === "|" && !inBackticks) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);

  // Si la fila inicia o termina con '|', eliminar los extremos vacíos
  if (cells.length > 0 && cells[0].trim() === "" && row.trim().startsWith("|")) {
    cells.shift();
  }
  if (cells.length > 0 && cells[cells.length - 1].trim() === "" && row.trim().endsWith("|")) {
    cells.pop();
  }

  return cells.map((c) => c.trim());
}

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || "texto"}</span>
        <button
          className={`md-code-copy-btn ${copied ? "is-copied" : ""}`}
          onClick={handleCopy}
          type="button"
          title="Copiar fragmento de código"
        >
          <Icon name={copied ? "check" : "copy"} />
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function getAlertIcon(type: string): IconName {
  switch (type) {
    case "TIP":
      return "sparkles";
    case "WARNING":
    case "IMPORTANT":
    case "NOTE":
      return "info";
    case "CAUTION":
      return "x";
    default:
      return "info";
  }
}

export function QuickLookMarkdown({ payload }: QuickLookMarkdownProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = useState(false);
  const content = payload.textContent || "";
  const lines = content.split("\n");

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert basic Markdown to safe structured HTML React elements
  const renderedElements = useMemo(() => {
    if (!content) return <p className="md-empty">Documento vacío.</p>;

    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeLines: string[] = [];
    let inList = false;
    let listType: "ul" | "ol" = "ul";
    let listItems: React.ReactNode[] = [];
    let currentParagraphLines: string[] = [];
    let consecutiveBlankLines = 0;

    const flushList = () => {
      if (inList && listItems.length > 0) {
        if (listType === "ol") {
          elements.push(
            <ol key={`ol-${elements.length}`} className="md-ol">
              {listItems}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`ul-${elements.length}`} className="md-ul">
              {listItems}
            </ul>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    const flushParagraph = () => {
      if (currentParagraphLines.length === 0) return;
      const pLines = [...currentParagraphLines];
      currentParagraphLines = [];

      elements.push(
        <p key={`p-${elements.length}`} className="md-paragraph">
          {pLines.map((lineText, idx) => (
            <span key={idx} className="md-line">
              {formatInline(lineText)}
              {idx < pLines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    };

    const flushAll = () => {
      flushList();
      flushParagraph();
    };

    const formatInline = (text: string): React.ReactNode => {
      if (!text) return "";
      // Precedencia: Imágenes -> Enlaces -> Código inline -> Negrita -> Cursiva -> Tachado
      const parts: React.ReactNode[] = [];
      let cursor = 0;

      // 1: Imagen (![alt](src))
      // 4: Enlace ([text](url))
      // 7: Código (`code`)
      // 9: Negrita (**bold**)
      // 11: Cursiva (*italic*)
      // 13: Tachado (~~del~~)
      const regex =
        /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > cursor) {
          parts.push(text.slice(cursor, match.index));
        }

        if (match[1]) {
          // Imagen: ![alt](url)
          parts.push(
            <img
              key={`img-${cursor}`}
              className="md-inline-image"
              src={match[3]}
              alt={match[2]}
              loading="lazy"
            />
          );
        } else if (match[4]) {
          // Enlace: [text](url) - permite formateo anidado como [`código`](url)
          parts.push(
            <a
              key={`link-${cursor}`}
              className="md-link"
              href={match[6]}
              rel="noopener noreferrer"
              target="_blank"
            >
              {formatInline(match[5])}
            </a>
          );
        } else if (match[7]) {
          // Código inline
          parts.push(
            <code key={`code-${cursor}`} className="md-inline-code">
              {match[8]}
            </code>
          );
        } else if (match[9]) {
          // Negrita
          parts.push(
            <strong key={`bold-${cursor}`} className="md-bold">
              {formatInline(match[10])}
            </strong>
          );
        } else if (match[11]) {
          // Cursiva
          parts.push(
            <em key={`italic-${cursor}`} className="md-italic">
              {formatInline(match[12])}
            </em>
          );
        } else if (match[13]) {
          // Tachado
          parts.push(
            <del key={`del-${cursor}`} className="md-del">
              {formatInline(match[14])}
            </del>
          );
        }

        cursor = regex.lastIndex;
      }

      if (cursor < text.length) {
        parts.push(text.slice(cursor));
      }

      return parts.length === 0 ? text : parts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Bloques de código con triple backtick
      if (trimmed.startsWith("```")) {
        flushAll();
        if (inCodeBlock) {
          elements.push(
            <CodeBlock
              key={`codeblock-${i}`}
              code={codeLines.join("\n")}
              language={codeLanguage}
            />
          );
          inCodeBlock = false;
          codeLanguage = "";
          codeLines = [];
        } else {
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Línea vacía / Salto de párrafo canónico (doble salto de línea)
      if (!trimmed) {
        flushAll();
        consecutiveBlankLines++;
        // Si hay múltiples líneas vacías consecutivas, renderizar espaciador visual
        if (consecutiveBlankLines > 1) {
          elements.push(
            <div key={`spacer-${i}`} className="md-empty-line" />
          );
        }
        continue;
      }

      // Reiniciar contador de líneas vacías consecutivas al encontrar contenido
      consecutiveBlankLines = 0;

      // Regla horizontal
      if (/^(\*\*\*|---|___)$/.test(trimmed)) {
        flushAll();
        elements.push(<hr key={`hr-${i}`} className="md-hr" />);
        continue;
      }

      // Tablas GFM
      if (
        trimmed.includes("|") &&
        i + 1 < lines.length &&
        isTableDelimiter(lines[i + 1])
      ) {
        flushAll();
        const headerCells = splitTableRow(trimmed);
        const delimiterCells = splitTableRow(lines[i + 1]);
        const alignments: ("left" | "center" | "right")[] = delimiterCells.map((cell) => {
          const c = cell.trim();
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });

        const tableRows: string[][] = [];
        let rowIdx = i + 2;
        while (rowIdx < lines.length) {
          const candidateLine = lines[rowIdx];
          const candidateTrimmed = candidateLine.trim();
          if (
            !candidateTrimmed ||
            candidateTrimmed.startsWith("#") ||
            candidateTrimmed.startsWith("```") ||
            /^(\*\*\*|---|___)$/.test(candidateTrimmed)
          ) {
            break;
          }
          if (candidateTrimmed.includes("|")) {
            tableRows.push(splitTableRow(candidateTrimmed));
            rowIdx++;
          } else {
            break;
          }
        }

        elements.push(
          <div key={`table-${i}`} className="md-table-wrapper">
            <table className="md-table">
              <thead>
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={`th-${hIdx}`}
                      style={{ textAlign: alignments[hIdx] || "left" }}
                    >
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`}>
                    {headerCells.map((_, cIdx) => (
                      <td
                        key={`td-${rIdx}-${cIdx}`}
                        style={{ textAlign: alignments[cIdx] || "left" }}
                      >
                        {formatInline(row[cIdx] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        i = rowIdx - 1;
        continue;
      }

      // Alertas estilo GitHub / Callouts (> [!NOTE], > [!TIP], etc.)
      const alertMatch = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(trimmed);
      if (alertMatch) {
        flushAll();
        const alertType = alertMatch[1].toUpperCase();
        const alertLines: string[] = [];
        const firstLineRest = trimmed.replace(
          /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
          ""
        );
        if (firstLineRest) alertLines.push(firstLineRest);

        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith(">")) {
          alertLines.push(lines[j].trim().replace(/^>\s?/, ""));
          j++;
        }
        i = j - 1;

        elements.push(
          <div key={`alert-${i}`} className={`md-alert md-alert-${alertType.toLowerCase()}`}>
            <div className="md-alert-title">
              <Icon name={getAlertIcon(alertType)} />
              <span>{alertType}</span>
            </div>
            <div className="md-alert-content">
              {alertLines.map((al, idx) => (
                <span key={idx} className="md-line">
                  {formatInline(al)}
                  {idx < alertLines.length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        );
        continue;
      }

      // Citas en bloque (Blockquotes estándar)
      if (trimmed.startsWith("> ")) {
        flushAll();
        const quoteLines: string[] = [trimmed.slice(2)];
        let j = i + 1;
        while (
          j < lines.length &&
          lines[j].trim().startsWith(">") &&
          !lines[j].trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
        ) {
          quoteLines.push(lines[j].trim().replace(/^>\s?/, ""));
          j++;
        }
        i = j - 1;

        // Agrupar líneas de cita en párrafos si hay líneas vacías ">"
        const quoteParagraphs: string[][] = [];
        let curQuoteP: string[] = [];
        for (const ql of quoteLines) {
          if (!ql.trim()) {
            if (curQuoteP.length > 0) {
              quoteParagraphs.push(curQuoteP);
              curQuoteP = [];
            }
          } else {
            curQuoteP.push(ql);
          }
        }
        if (curQuoteP.length > 0) quoteParagraphs.push(curQuoteP);

        elements.push(
          <blockquote key={`quote-${i}`} className="md-blockquote">
            {quoteParagraphs.map((qp, pIdx) => (
              <p key={pIdx} className="md-paragraph">
                {qp.map((lineText, lIdx) => (
                  <span key={lIdx} className="md-line">
                    {formatInline(lineText)}
                    {lIdx < qp.length - 1 && <br />}
                  </span>
                ))}
              </p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Encabezados
      if (trimmed.startsWith("# ")) {
        flushAll();
        elements.push(<h1 key={`h1-${i}`} className="md-h1">{formatInline(trimmed.slice(2))}</h1>);
        continue;
      }
      if (trimmed.startsWith("## ")) {
        flushAll();
        elements.push(<h2 key={`h2-${i}`} className="md-h2">{formatInline(trimmed.slice(3))}</h2>);
        continue;
      }
      if (trimmed.startsWith("### ")) {
        flushAll();
        elements.push(<h3 key={`h3-${i}`} className="md-h3">{formatInline(trimmed.slice(4))}</h3>);
        continue;
      }
      if (trimmed.startsWith("#### ")) {
        flushAll();
        elements.push(<h4 key={`h4-${i}`} className="md-h4">{formatInline(trimmed.slice(5))}</h4>);
        continue;
      }
      if (trimmed.startsWith("##### ")) {
        flushAll();
        elements.push(<h5 key={`h5-${i}`} className="md-h5">{formatInline(trimmed.slice(6))}</h5>);
        continue;
      }
      if (trimmed.startsWith("###### ")) {
        flushAll();
        elements.push(<h6 key={`h6-${i}`} className="md-h6">{formatInline(trimmed.slice(7))}</h6>);
        continue;
      }

      // Tareas (- [ ] o - [x])
      const taskMatch = /^- \[( |x|X)\] (.*)$/.exec(trimmed);
      if (taskMatch) {
        flushAll();
        const checked = taskMatch[1].toLowerCase() === "x";
        elements.push(
          <div key={`task-${i}`} className="md-task-item">
            <input checked={checked} disabled type="checkbox" />
            <span className={checked ? "is-done" : ""}>{formatInline(taskMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Listas no ordenadas (*, -, +)
      if (/^[-*+]\s+/.test(trimmed)) {
        flushParagraph();
        inList = true;
        listType = "ul";
        listItems.push(
          <li key={`li-${i}`} className="md-li">
            {formatInline(trimmed.replace(/^[-*+]\s+/, ""))}
          </li>
        );
        continue;
      }

      // Listas ordenadas (1., 2., etc.)
      if (/^\d+\.\s+/.test(trimmed)) {
        flushParagraph();
        inList = true;
        listType = "ol";
        listItems.push(
          <li key={`li-${i}`} className="md-li">
            {formatInline(trimmed.replace(/^\d+\.\s+/, ""))}
          </li>
        );
        continue;
      }

      // Párrafo normal: acumular líneas consecutivas dentro del mismo párrafo / estrofa
      flushList();
      currentParagraphLines.push(line);
    }

    flushAll();
    return elements;
  }, [content]);

  return (
    <div className="quicklook-text-container quicklook-markdown-container">
      <div className="quicklook-text-toolbar">
        <div className="quicklook-markdown-tabs">
          <button
            className={`quicklook-md-tab ${viewMode === "rendered" ? "is-active" : ""}`}
            onClick={() => setViewMode("rendered")}
            type="button"
          >
            <Icon name="book-open" />
            <span>Vista previa</span>
          </button>
          <button
            className={`quicklook-md-tab ${viewMode === "raw" ? "is-active" : ""}`}
            onClick={() => setViewMode("raw")}
            type="button"
          >
            <Icon name="file-code" />
            <span>Código fuente</span>
          </button>
        </div>

        <div className="quicklook-md-actions">
          <span className="quicklook-text-stats">
            {lines.length} {lines.length === 1 ? "línea" : "líneas"} • {content.length} caracteres
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

      {viewMode === "rendered" ? (
        <div className="quicklook-markdown-body">
          <article className="markdown-rendered-content">{renderedElements}</article>
        </div>
      ) : (
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
      )}
    </div>
  );
}


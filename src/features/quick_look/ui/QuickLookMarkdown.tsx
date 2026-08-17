import { useMemo, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookMarkdownProps {
  payload: QuickLookPayload;
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

    const flushList = () => {
      if (inList && listItems.length > 0) {
        if (listType === "ol") {
          elements.push(<ol key={`ol-${elements.length}`} className="md-ol">{listItems}</ol>);
        } else {
          elements.push(<ul key={`ul-${elements.length}`} className="md-ul">{listItems}</ul>);
        }
        listItems = [];
        inList = false;
      }
    };

    const formatInline = (text: string): React.ReactNode => {
      // Inline formatting: `code`, **bold**, *italic*, ~~strikethrough~~, [links](url)
      const parts: React.ReactNode[] = [];
      let cursor = 0;

      // Regex for inline patterns
      const regex = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)|(\[([^\]]+)\]\(([^)]+)\))/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > cursor) {
          parts.push(text.slice(cursor, match.index));
        }

        if (match[2]) {
          // Inline code
          parts.push(<code key={`code-${cursor}`} className="md-inline-code">{match[2]}</code>);
        } else if (match[4]) {
          // Bold
          parts.push(<strong key={`bold-${cursor}`} className="md-bold">{formatInline(match[4])}</strong>);
        } else if (match[6]) {
          // Italic
          parts.push(<em key={`italic-${cursor}`} className="md-italic">{formatInline(match[6])}</em>);
        } else if (match[8]) {
          // Strikethrough
          parts.push(<del key={`del-${cursor}`} className="md-del">{formatInline(match[8])}</del>);
        } else if (match[10] && match[11]) {
          // Link
          parts.push(
            <a
              key={`link-${cursor}`}
              className="md-link"
              href={match[11]}
              rel="noopener noreferrer"
              target="_blank"
            >
              {match[10]}
            </a>
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

      // Fenced code blocks ```
      if (trimmed.startsWith("```")) {
        flushList();
        if (inCodeBlock) {
          elements.push(
            <div key={`codeblock-${i}`} className="md-code-block">
              {codeLanguage ? <div className="md-code-header">{codeLanguage}</div> : null}
              <pre>
                <code>{codeLines.join("\n")}</code>
              </pre>
            </div>
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

      // Empty line
      if (!trimmed) {
        flushList();
        continue;
      }

      // Horizontal Rule
      if (/^(\*\*\*|---|___)$/.test(trimmed)) {
        flushList();
        elements.push(<hr key={`hr-${i}`} className="md-hr" />);
        continue;
      }

      // Headings
      if (trimmed.startsWith("# ")) {
        flushList();
        elements.push(<h1 key={`h1-${i}`} className="md-h1">{formatInline(trimmed.slice(2))}</h1>);
        continue;
      }
      if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(<h2 key={`h2-${i}`} className="md-h2">{formatInline(trimmed.slice(3))}</h2>);
        continue;
      }
      if (trimmed.startsWith("### ")) {
        flushList();
        elements.push(<h3 key={`h3-${i}`} className="md-h3">{formatInline(trimmed.slice(4))}</h3>);
        continue;
      }
      if (trimmed.startsWith("#### ")) {
        flushList();
        elements.push(<h4 key={`h4-${i}`} className="md-h4">{formatInline(trimmed.slice(5))}</h4>);
        continue;
      }
      if (trimmed.startsWith("##### ")) {
        flushList();
        elements.push(<h5 key={`h5-${i}`} className="md-h5">{formatInline(trimmed.slice(6))}</h5>);
        continue;
      }
      if (trimmed.startsWith("###### ")) {
        flushList();
        elements.push(<h6 key={`h6-${i}`} className="md-h6">{formatInline(trimmed.slice(7))}</h6>);
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith("> ")) {
        flushList();
        elements.push(
          <blockquote key={`quote-${i}`} className="md-blockquote">
            {formatInline(trimmed.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Checkbox / Tasks (- [ ] or - [x])
      const taskMatch = /^- \[( |x|X)\] (.*)$/.exec(trimmed);
      if (taskMatch) {
        flushList();
        const checked = taskMatch[1].toLowerCase() === "x";
        elements.push(
          <div key={`task-${i}`} className="md-task-item">
            <input checked={checked} disabled type="checkbox" />
            <span className={checked ? "is-done" : ""}>{formatInline(taskMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Unordered Lists (*, -, +)
      if (/^[-*+]\s+/.test(trimmed)) {
        inList = true;
        listType = "ul";
        listItems.push(
          <li key={`li-${i}`} className="md-li">
            {formatInline(trimmed.replace(/^[-*+]\s+/, ""))}
          </li>
        );
        continue;
      }

      // Ordered Lists (1., 2., etc.)
      if (/^\d+\.\s+/.test(trimmed)) {
        inList = true;
        listType = "ol";
        listItems.push(
          <li key={`li-${i}`} className="md-li">
            {formatInline(trimmed.replace(/^\d+\.\s+/, ""))}
          </li>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${i}`} className="md-paragraph">
          {formatInline(line)}
        </p>
      );
    }

    flushList();
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

import { useEffect, useState, useMemo, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { CustomLibraryItem } from "../model/types";
import {
  customLibrariesReadTextFile,
  customLibrariesSaveTextFile,
  customLibrariesOpenFile,
  customLibrariesGetThumbnail,
} from "../tauri/client";
import "./document-viewer.css";

interface DocumentViewerProps {
  item: CustomLibraryItem;
  itemsList?: CustomLibraryItem[];
  onClose: () => void;
  onSelectDoc?: (item: CustomLibraryItem) => void;
  externalAppCommand?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function getFileIcon(ext: string): IconName {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "file-text";
    case "epub":
    case "mobi":
    case "cbz":
    case "cbr":
      return "book-open";
    case "kra":
    case "krz":
    case "ora":
      return "palette";
    case "af":
    case "afphoto":
    case "afdesign":
    case "afpub":
    case "aftemplate":
    case "psd":
    case "psb":
    case "ai":
      return "layers";
    case "drp":
    case "dra":
      return "film";
    case "blend":
    case "obj":
    case "fbx":
      return "box";
    case "md":
    case "markdown":
      return "file-code";
    default:
      return "file";
  }
}

export function DocumentViewer({
  item,
  itemsList = [],
  onClose,
  onSelectDoc,
  externalAppCommand,
}: DocumentViewerProps) {
  const ext = item.extension.toLowerCase();
  const isPdf = ext === "pdf";
  const isMarkdown = ext === "md" || ext === "markdown";
  const isPlainText = [
    "txt", "json", "csv", "log", "yaml", "yml", "xml", "toml", "rs",
    "ts", "tsx", "js", "jsx", "py", "css", "html", "ini", "env", "sh", "ps1"
  ].includes(ext);
  const isProjectOrImage = [
    "kra", "krz", "ora", "af", "afphoto", "afdesign", "afpub", "aftemplate",
    "psd", "psb", "ai", "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"
  ].includes(ext);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "split" | "code">(isMarkdown ? "preview" : "code");
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [fontSize, setFontSize] = useState<number>(15);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  // Índice para navegación secuencial
  const currentIndex = itemsList.findIndex((it) => it.path === item.path);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < itemsList.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectDoc) {
      onSelectDoc(itemsList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectDoc) {
      onSelectDoc(itemsList[currentIndex + 1]);
    }
  };

  // Carga de contenido según el tipo
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setTextContent(null);
    setOriginalText(null);
    setProjectThumbnail(null);
    setIsDirty(false);
    setIsSaved(false);

    if (isPdf) {
      setLoading(false);
      return;
    }

    if (isMarkdown || isPlainText) {
      customLibrariesReadTextFile(item.path)
        .then((text) => {
          if (isMounted) {
            setTextContent(text);
            setOriginalText(text);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(String(err));
            setLoading(false);
          }
        });
      return;
    }

    if (isProjectOrImage) {
      customLibrariesGetThumbnail(item.path)
        .then((thumb) => {
          if (isMounted) {
            setProjectThumbnail(thumb);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(String(err));
            setLoading(false);
          }
        });
      return;
    }

    setLoading(false);

    return () => {
      isMounted = false;
    };
  }, [item.path, isPdf, isMarkdown, isPlainText, isProjectOrImage]);

  const handleSave = async () => {
    if (textContent === null || isSaving) return;
    setIsSaving(true);
    try {
      await customLibrariesSaveTextFile(item.path, textContent);
      setOriginalText(textContent);
      setIsDirty(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalText !== null) {
      setTextContent(originalText);
      setIsDirty(false);
    }
  };

  // Atajos de teclado (Escape para salir, Flechas para navegar, Ctrl+S para guardar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (textContent !== null && isDirty) {
          void handleSave();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev && !isPdf && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" && hasNext && !isPdf && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, hasPrev, hasNext, currentIndex, isPdf, textContent, isSaving]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const newVal = val.substring(0, start) + "  " + val.substring(end);
      setTextContent(newVal);
      setIsDirty(true);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  const handleScrollTextarea = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleCopyContent = () => {
    if (!textContent) return;
    void navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(item.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleOpenExternal = () => {
    void customLibrariesOpenFile(item.path, externalAppCommand);
  };

  // Renderizado simple y elegante de Markdown
  const renderedMarkdownHtml = useMemo(() => {
    if (!textContent || !isMarkdown) return "";
    
    // Escapar etiquetas HTML
    let html = textContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bloques de código con triple backtick
    html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Código inline con un solo backtick
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Encabezados (# Título)
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Negrita e Itálica
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

    // Listas desordenadas y Checkboxes
    html = html.replace(/^\s*-\s+\[x\]\s+(.*$)/gim, '<li style="list-style-type: none;">☑️ $1</li>');
    html = html.replace(/^\s*-\s+\[ \]\s+(.*$)/gim, '<li style="list-style-type: none;">⬜ $1</li>');
    html = html.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");

    // Párrafos (separados por doble salto de línea)
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (
          trimmed.startsWith("<h") ||
          trimmed.startsWith("<pre") ||
          trimmed.startsWith("<blockquote") ||
          trimmed.startsWith("<li")
        ) {
          return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
      })
      .join("\n");

    return html;
  }, [textContent, isMarkdown]);

  const textLines = useMemo(() => {
    return textContent !== null ? textContent.split("\n") : [];
  }, [textContent]);

  return (
    <div className="doc-viewer-overlay" role="dialog" aria-modal="true">
      {/* ── Barra Superior / Encabezado ── */}
      <header className="doc-viewer-header">
        <div className="doc-viewer-header-left">
          <div className="doc-viewer-file-icon">
            <Icon name={getFileIcon(item.extension)} />
          </div>
          <div className="doc-viewer-file-info">
            <div className="doc-viewer-title-row">
              <span className="doc-viewer-title" title={item.name}>
                {item.name}
              </span>
              <span className="doc-viewer-ext-badge">.{item.extension}</span>
              {isDirty && <span className="doc-viewer-dirty-badge">● Modificado</span>}
            </div>
            <span className="doc-viewer-meta">
              {formatBytes(item.sizeBytes)}
              {item.relativeFolder ? ` • ${item.relativeFolder}` : ""}
              {itemsList.length > 0 ? ` (${currentIndex + 1} de ${itemsList.length})` : ""}
            </span>
          </div>
        </div>

        <div className="doc-viewer-header-actions">
          {isDirty && (
            <button
              className="doc-viewer-discard-btn"
              disabled={isSaving}
              onClick={handleDiscard}
              title="Cancelar modificaciones y restaurar texto original"
              type="button"
            >
              <Icon name="undo" />
              <span>Descartar</span>
            </button>
          )}

          {isDirty ? (
            <button
              className="doc-viewer-save-btn"
              disabled={isSaving}
              onClick={() => void handleSave()}
              title="Guardar archivo en disco (Ctrl+S)"
              type="button"
            >
              <Icon name="save" />
              <span>{isSaving ? "Guardando…" : "Guardar cambios"}</span>
            </button>
          ) : isSaved ? (
            <button
              className="doc-viewer-save-btn is-saved"
              disabled
              title="Cambios guardados con éxito en el archivo"
              type="button"
            >
              <Icon name="check" />
              <span>Guardado</span>
            </button>
          ) : null}

          {textContent !== null ? (
            <button
              className="doc-viewer-action-btn"
              onClick={handleCopyContent}
              title="Copiar contenido al portapapeles"
              type="button"
            >
              <Icon name={copied ? "check" : "copy"} />
              <span>{copied ? "Copiado" : "Copiar"}</span>
            </button>
          ) : null}

          <button
            className="doc-viewer-action-btn"
            onClick={handleCopyPath}
            title="Copiar ruta absoluta"
            type="button"
          >
            <Icon name={copiedPath ? "check" : "link"} />
            <span>{copiedPath ? "Ruta copiada" : "Ruta"}</span>
          </button>

          <button
            className="doc-viewer-action-btn"
            onClick={handleOpenExternal}
            title="Abrir en explorador o aplicación predeterminada"
            type="button"
          >
            <Icon name="external-link" />
            <span>Abrir fuera</span>
          </button>

          <button
            aria-label="Cerrar visor"
            className="doc-viewer-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
            type="button"
          >
            <Icon name="x" />
          </button>
        </div>
      </header>

      {/* ── Cuerpo Principal de Visualización ── */}
      <main className="doc-viewer-body">
        {/* Botones Flotantes de Navegación */}
        {hasPrev && !isPdf && (
          <button
            aria-label="Archivo anterior"
            className="doc-viewer-nav-btn is-prev"
            onClick={handlePrev}
            title="Anterior (←)"
            type="button"
          >
            <Icon name="chevron-left" />
          </button>
        )}

        {hasNext && !isPdf && (
          <button
            aria-label="Archivo siguiente"
            className="doc-viewer-nav-btn is-next"
            onClick={handleNext}
            title="Siguiente (→)"
            type="button"
          >
            <Icon name="chevron-right" />
          </button>
        )}

        {/* ── 1. Visor PDF Integrado ── */}
        {isPdf ? (
          <iframe
            className="doc-viewer-pdf-frame"
            src={`${convertFileSrc(item.path)}#toolbar=1&navpanes=1`}
            title={item.name}
          />
        ) : null}

        {/* ── 2. Visor Markdown / Texto Plano / Editor ── */}
        {(isMarkdown || isPlainText) && !loading && (
          <div className="doc-viewer-text-pane">
            <div className="doc-viewer-text-toolbar">
              {isMarkdown ? (
                <div className="doc-viewer-text-tabs">
                  <button
                    className={`doc-viewer-tab-btn ${viewMode === "preview" ? "is-active" : ""}`}
                    onClick={() => setViewMode("preview")}
                    type="button"
                  >
                    <Icon name="eye" /> Vista previa
                  </button>
                  <button
                    className={`doc-viewer-tab-btn ${viewMode === "split" ? "is-active" : ""}`}
                    onClick={() => setViewMode("split")}
                    type="button"
                  >
                    <Icon name="layout" /> Dividido
                  </button>
                  <button
                    className={`doc-viewer-tab-btn ${viewMode === "code" ? "is-active" : ""}`}
                    onClick={() => setViewMode("code")}
                    type="button"
                  >
                    <Icon name="file-code" /> Editor fuente
                  </button>
                </div>
              ) : (
                <span className="doc-viewer-meta">
                  {textLines.length} {textLines.length === 1 ? "línea" : "líneas"} • {textContent?.length || 0} caracteres
                </span>
              )}

              <div className="doc-viewer-text-controls">
                {viewMode !== "split" && (
                  <button
                    className={`doc-viewer-tool-btn ${isFullWidth ? "is-active" : ""}`}
                    onClick={() => setIsFullWidth((w) => !w)}
                    title={isFullWidth ? "Cambiar a lectura centrada (880px)" : "Cambiar a ancho completo"}
                    type="button"
                  >
                    <Icon name={isFullWidth ? "fit-screen" : "fullscreen"} />
                    <span>{isFullWidth ? "Ancho completo" : "Centrado"}</span>
                  </button>
                )}

                <div className="doc-viewer-font-picker">
                  <button
                    className={`doc-viewer-font-btn ${fontFamily === "sans" ? "is-active" : ""}`}
                    onClick={() => setFontFamily("sans")}
                    title="Tipografía Moderna (Sans-Serif)"
                    type="button"
                  >
                    Sans
                  </button>
                  <button
                    className={`doc-viewer-font-btn ${fontFamily === "serif" ? "is-active" : ""}`}
                    onClick={() => setFontFamily("serif")}
                    title="Tipografía Editorial / Libro (Serif)"
                    type="button"
                  >
                    Serif
                  </button>
                  <button
                    className={`doc-viewer-font-btn ${fontFamily === "mono" ? "is-active" : ""}`}
                    onClick={() => setFontFamily("mono")}
                    title="Tipografía Monoespaciada (Código)"
                    type="button"
                  >
                    Mono
                  </button>
                </div>

                <div className="doc-viewer-zoom-controls">
                  <button
                    aria-label="Reducir fuente"
                    className="doc-viewer-zoom-btn"
                    onClick={() => setFontSize((f) => Math.max(f - 1, 11))}
                    title="Reducir tamaño de letra"
                    type="button"
                  >
                    <Icon name="minus" />
                  </button>
                  <span className="doc-viewer-zoom-label" title="Tamaño de letra">{fontSize}px</span>
                  <button
                    aria-label="Aumentar fuente"
                    className="doc-viewer-zoom-btn"
                    onClick={() => setFontSize((f) => Math.min(f + 1, 32))}
                    title="Aumentar tamaño de letra"
                    type="button"
                  >
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
            </div>

            {/* Renderizado de Modos (Dividido vs Individual) */}
            {isMarkdown && viewMode === "split" ? (
              <div className="doc-viewer-split-container">
                <div className="doc-viewer-split-pane">
                  <div className="doc-viewer-split-header">
                    <span>Editor de código fuente</span>
                    {isDirty && <span className="doc-viewer-dirty-badge">● Modificado</span>}
                  </div>
                  <div className="doc-viewer-code-container" style={{ fontSize: `${fontSize}px` }}>
                    <div className="doc-viewer-line-numbers" ref={lineNumbersRef} aria-hidden="true">
                      {textLines.map((_, i) => (
                        <span key={i}>{i + 1}</span>
                      ))}
                    </div>
                    <textarea
                      className="doc-viewer-textarea"
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextContent(val);
                        setIsDirty(val !== originalText);
                      }}
                      onKeyDown={handleTextareaKeyDown}
                      onScroll={handleScrollTextarea}
                      ref={textareaRef}
                      spellCheck={false}
                      value={textContent || ""}
                    />
                  </div>
                </div>
                <div className="doc-viewer-split-pane">
                  <div className="doc-viewer-split-header">
                    <span>Vista previa en vivo</span>
                  </div>
                  <div
                    className={`doc-viewer-scrollable is-full-width doc-viewer-font-${fontFamily}`}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    <div
                      className="doc-viewer-md-rendered"
                      dangerouslySetInnerHTML={{ __html: renderedMarkdownHtml }}
                    />
                  </div>
                </div>
              </div>
            ) : isMarkdown && viewMode === "preview" ? (
              <div
                className={`doc-viewer-scrollable ${
                  isFullWidth ? "is-full-width" : "is-centered"
                } doc-viewer-font-${fontFamily}`}
                style={{ fontSize: `${fontSize}px` }}
              >
                <div
                  className="doc-viewer-md-rendered"
                  dangerouslySetInnerHTML={{ __html: renderedMarkdownHtml }}
                />
              </div>
            ) : (
              <div
                className={`doc-viewer-code-container ${
                  isFullWidth ? "is-full-width" : "is-centered"
                }`}
                style={{ fontSize: `${fontSize}px` }}
              >
                <div className="doc-viewer-line-numbers" ref={lineNumbersRef} aria-hidden="true">
                  {textLines.map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <textarea
                  className="doc-viewer-textarea"
                  onChange={(e) => {
                    const val = e.target.value;
                    setTextContent(val);
                    setIsDirty(val !== originalText);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  onScroll={handleScrollTextarea}
                  ref={textareaRef}
                  spellCheck={false}
                  value={textContent || ""}
                />
              </div>
            )}
          </div>
        )}

        {/* ── 3. Proyectos / Diseños Gráficos (.af, .kra, etc.) ── */}
        {isProjectOrImage && !loading && (
          <div className="doc-viewer-project-view">
            {projectThumbnail ? (
              <div className="doc-viewer-project-preview-box">
                <img alt={item.name} src={projectThumbnail} />
              </div>
            ) : (
              <div className="doc-viewer-file-icon" style={{ width: 96, height: 96, borderRadius: 24 }}>
                <Icon name={getFileIcon(item.extension)} />
              </div>
            )}
            <button
              className="doc-viewer-project-action-btn"
              onClick={handleOpenExternal}
              type="button"
            >
              <Icon name="external-link" /> Abrir en aplicación asociada
            </button>
          </div>
        )}

        {/* ── 4. Estado de Carga o Error ── */}
        {loading && (
          <div className="doc-viewer-loading-state">
            <div className="doc-viewer-spinner" />
            <span>Cargando documento…</span>
          </div>
        )}

        {error && (
          <div className="doc-viewer-loading-state">
            <Icon name="info" />
            <span>{error}</span>
          </div>
        )}
      </main>
    </div>
  );
}

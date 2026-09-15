import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../../shared/ui/Icon";
import { SUPPORTED_IMAGE_EXTENSIONS, isImagePath } from "./types";

interface ImageComparisonSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPath: (filePath: string) => void;
  onOpenLibrary: () => void;
  title?: string;
  isNativeDragOver?: boolean;
}

export function ImageComparisonSourceModal({
  isOpen,
  onClose,
  onSelectPath,
  onOpenLibrary,
  title = "Añadir imagen a la comparativa",
  isNativeDragOver = false,
}: ImageComparisonSourceModalProps) {
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDragActive = isNativeDragOver || isHtmlDragOver;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    if (!isHtmlDragOver) setIsHtmlDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHtmlDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHtmlDragOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = (file as unknown as { path?: string }).path;
      if (filePath && isImagePath(filePath)) {
        onSelectPath(filePath);
        onClose();
      }
    }
  };

  const handleBrowseExplorer = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Imágenes",
            extensions: SUPPORTED_IMAGE_EXTENSIONS,
          },
        ],
      });

      if (selected && typeof selected === "string" && isImagePath(selected)) {
        onSelectPath(selected);
        onClose();
      }
    } catch {}
  };

  return (
    <div className="img-compare-source-backdrop" onClick={onClose}>
      <div
        className={`img-compare-source-modal ${isDragActive ? "is-drag-over" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-drop-zone="source-modal"
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <header className="img-compare-source-header">
          <div className="img-compare-source-title-wrap">
            <span className="img-compare-source-icon">
              <Icon name="compare" />
            </span>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="img-compare-source-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="img-compare-source-body">
          {/* Tarjeta de Drag & Drop */}
          <div className={`img-compare-source-drop-area ${isDragActive ? "is-active" : ""}`}>
            <div className="img-compare-source-drop-icon">
              <Icon name={isDragActive ? "download" : "image"} />
            </div>
            <h4>{isDragActive ? "¡Suelta la imagen aquí!" : "Arrastra una imagen aquí"}</h4>
            <p>Puedes arrastrar cualquier archivo desde el Explorador de Windows o el escritorio</p>
          </div>

          <div className="img-compare-source-divider">
            <span>o selecciona un origen</span>
          </div>

          {/* Opciones de Selección */}
          <div className="img-compare-source-buttons">
            <button
              type="button"
              className="img-compare-source-choice-btn is-library"
              onClick={() => {
                onClose();
                onOpenLibrary();
              }}
            >
              <div className="img-compare-source-btn-icon">
                <Icon name="layers" />
              </div>
              <div className="img-compare-source-btn-text">
                <span className="btn-title">Biblioteca</span>
                <span className="btn-desc">Ver fotos y carpetas en Prisma</span>
              </div>
            </button>

            <button
              type="button"
              className="img-compare-source-choice-btn is-explorer"
              onClick={handleBrowseExplorer}
            >
              <div className="img-compare-source-btn-icon">
                <Icon name="folder-open" />
              </div>
              <div className="img-compare-source-btn-text">
                <span className="btn-title">Explorador</span>
                <span className="btn-desc">Examinar archivo en tu PC</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

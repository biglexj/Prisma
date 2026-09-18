import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { isSupportedMediaPath } from "../model/types";

interface ImageComparisonEmptySlotProps {
  onPickLibrary: () => void;
  onPickExplorer: () => void;
  onDropFile?: (filePath: string) => void;
  onDropFiles?: (filePaths: string[]) => void;
  isNativeDragOver?: boolean;
  tagLabel?: string;
  title?: string;
  subtitle?: string;
  dropZone?: string;
}

export function ImageComparisonEmptySlot({
  onPickLibrary,
  onPickExplorer,
  onDropFile,
  onDropFiles,
  isNativeDragOver = false,
  tagLabel = "Elemento B (A Comparar)",
  title = "Arrastra una imagen o vídeo aquí",
  subtitle = "o elige una fuente para contrastar con el archivo base",
  dropZone = "slot-b",
}: ImageComparisonEmptySlotProps) {
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);

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
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const filePath = (file as unknown as { path?: string }).path;
        if (filePath && isSupportedMediaPath(filePath)) {
          paths.push(filePath);
        }
      }

      if (paths.length > 0) {
        if (onDropFiles) {
          onDropFiles(paths);
        } else if (onDropFile) {
          onDropFile(paths[0]);
        }
      }
    }
  };

  return (
    <div
      className={`img-compare-empty-slot-wrapper ${isDragActive ? "is-drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-drop-zone={dropZone}
    >
      <div className="img-compare-slot-header">
        <span className="img-compare-slot-tag is-b">{tagLabel}</span>
        <span className="img-compare-slot-title">Pendiente de selección</span>
      </div>

      <div className="img-compare-empty-slot-content">
        <div className="img-compare-empty-drop-card">
          <div className="img-compare-empty-icon-circle">
            <Icon name={isDragActive ? "download" : "image"} />
          </div>

          <h3 className="img-compare-empty-title">{isDragActive ? "¡Suelta el archivo aquí!" : title}</h3>
          <p className="img-compare-empty-sub">{subtitle}</p>

          <div className="img-compare-empty-actions">
            <button
              type="button"
              className="img-compare-empty-btn is-library"
              onClick={onPickLibrary}
              title="Seleccionar foto o vídeo de tu biblioteca"
            >
              <Icon name="layers" />
              <span>Biblioteca</span>
            </button>

            <button
              type="button"
              className="img-compare-empty-btn is-explorer"
              onClick={onPickExplorer}
              title="Examinar y abrir cualquier archivo desde tu disco"
            >
              <Icon name="folder-open" />
              <span>Explorador</span>
            </button>
          </div>

          <div className="img-compare-empty-formats-hint">
            <span>Formatos: Fotos (PNG, JPG, WEBP, AVIF...) y Vídeos (MP4, WEBM, MKV, MOV...)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

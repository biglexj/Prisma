import { useState } from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import { isSupportedMediaPath, getMediaType, type ComparisonMediaType } from "../model/types";

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
  mediaType?: "any" | ComparisonMediaType;
}

export function ImageComparisonEmptySlot({
  onPickLibrary,
  onPickExplorer,
  onDropFile,
  onDropFiles,
  isNativeDragOver = false,
  tagLabel = "Elemento B (A Comparar)",
  title,
  subtitle = "o elige una fuente para contrastar con el archivo base",
  dropZone = "slot-b",
  mediaType = "any",
}: ImageComparisonEmptySlotProps) {
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);

  const isDragActive = isNativeDragOver || isHtmlDragOver;
  const resolvedMediaType = mediaType || "any";

  const defaultTitle =
    resolvedMediaType === "image"
      ? "Arrastra una imagen aquí"
      : resolvedMediaType === "video"
        ? "Arrastra un vídeo aquí"
        : resolvedMediaType === "audio"
          ? "Arrastra una pista de audio aquí"
          : "Arrastra una imagen, vídeo o audio aquí";

  const displayTitle = title ?? defaultTitle;

  const defaultIconName: IconName =
    resolvedMediaType === "image"
      ? "image"
      : resolvedMediaType === "video"
        ? "video"
        : resolvedMediaType === "audio"
          ? "music"
          : "layers";

  const dropActiveTitle =
    resolvedMediaType === "image"
      ? "¡Suelta la imagen aquí!"
      : resolvedMediaType === "video"
        ? "¡Suelta el vídeo aquí!"
        : resolvedMediaType === "audio"
          ? "¡Suelta el audio aquí!"
          : "¡Suelta el archivo aquí!";

  const formatsHint =
    resolvedMediaType === "image"
      ? "Formatos: Fotos (PNG, JPG, WEBP, AVIF, GIF, BMP, SVG...)"
      : resolvedMediaType === "video"
        ? "Formatos: Vídeos (MP4, WEBM, MKV, MOV, AVI, WMV...)"
        : resolvedMediaType === "audio"
          ? "Formatos: Audios (MP3, FLAC, WAV, M4A, OGG, OPUS, AIFF...)"
          : "Formatos: Fotos (PNG, JPG...), Vídeos (MP4, MKV...) y Audios (MP3, FLAC, WAV...)";

  const libraryTooltip =
    resolvedMediaType === "image"
      ? "Seleccionar foto de tu biblioteca"
      : resolvedMediaType === "video"
        ? "Seleccionar vídeo de tu biblioteca"
        : resolvedMediaType === "audio"
          ? "Seleccionar audio o música de tu biblioteca"
          : "Seleccionar foto, vídeo o audio de tu biblioteca";

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
          if (resolvedMediaType === "any" || getMediaType(filePath) === resolvedMediaType) {
            paths.push(filePath);
          }
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
            <Icon name={isDragActive ? "download" : defaultIconName} />
          </div>

          <h3 className="img-compare-empty-title">{isDragActive ? dropActiveTitle : displayTitle}</h3>
          <p className="img-compare-empty-sub">{subtitle}</p>

          <div className="img-compare-empty-actions">
            <button
              type="button"
              className="img-compare-empty-btn is-library"
              onClick={onPickLibrary}
              title={libraryTooltip}
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
            <span>{formatsHint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

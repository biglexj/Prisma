import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import type { DuplicateScanKind } from "./DuplicateGroupCard";

export type DuplicateScanMode = "single_folder" | "two_folders" | "library";

interface DuplicatesEmptyStateProps {
  hasScanned: boolean;
  scanMode: DuplicateScanMode;
  singleFolder: string | null;
  activeKind: DuplicateScanKind;
  hoveredDropZone: "single" | "base" | "target" | null;
  isScanning: boolean;
  handlePickSingleFolder: () => void;
  handleStartScan: () => void;
  applyDroppedPaths: (paths: string[], zone: "single" | "base" | "target" | null) => void;
  setHasScanned: (val: boolean) => void;
  setHoveredDropZone: (zone: "single" | "base" | "target" | null) => void;
  hoveredDropZoneRef: React.MutableRefObject<"single" | "base" | "target" | null>;
  setIsDraggingOver: (val: boolean) => void;
}

export const DuplicatesEmptyState: React.FC<DuplicatesEmptyStateProps> = ({
  hasScanned,
  scanMode,
  singleFolder,
  activeKind,
  hoveredDropZone,
  isScanning,
  handlePickSingleFolder,
  handleStartScan,
  applyDroppedPaths,
  setHasScanned,
  setHoveredDropZone,
  hoveredDropZoneRef,
  setIsDraggingOver,
}) => {
  if (hasScanned) {
    return (
      <div className="duplicates-empty-view">
        <Icon name="check" />
        <h3>¡No se encontraron archivos duplicados!</h3>
        <p>
          Las carpetas o biblioteca no contienen archivos duplicados con los criterios activos.
        </p>
        <div style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            className="duplicates-hero-btn"
            onClick={() => {
              setHasScanned(false);
              if (scanMode === "single_folder") handlePickSingleFolder();
            }}
          >
            <Icon name="refresh" />
            <span>Escanear otra carpeta</span>
          </button>
        </div>
      </div>
    );
  }

  if (scanMode === "single_folder") {
    if (!singleFolder) {
      return (
        <div
          className={`duplicates-hero-dropzone ${hoveredDropZone === "single" ? "is-drag-over" : ""}`}
          data-drop-zone="single"
          onClick={handlePickSingleFolder}
          onDragEnter={() => {
            setHoveredDropZone("single");
            hoveredDropZoneRef.current = "single";
          }}
          onDragLeave={() => {
            if (hoveredDropZoneRef.current === "single") {
              setHoveredDropZone(null);
              hoveredDropZoneRef.current = null;
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = "copy";
            }
            if (hoveredDropZoneRef.current !== "single") {
              setHoveredDropZone("single");
              hoveredDropZoneRef.current = "single";
            }
          }}
        >
          <div className="duplicates-hero-icon">
            <Icon name="folder-open" />
          </div>
          <h3 className="duplicates-hero-title">Arrastra tu carpeta aquí o haz clic para examinar</h3>
          <p className="duplicates-hero-desc">
            Se analizarán todos los archivos y subcarpetas con inteligencia de nombres naturales y detección profunda de duplicados.
          </p>
          <button
            type="button"
            className="duplicates-hero-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePickSingleFolder();
            }}
          >
            <Icon name="folder" />
            <span>Examinar Carpeta...</span>
          </button>
        </div>
      );
    }

    return (
      <div className="duplicates-ready-card">
        <div className="duplicates-ready-icon">
          <Icon name="check" />
        </div>
        <h3 className="duplicates-ready-title">Carpeta lista para escanear</h3>
        <div className="duplicates-ready-path" title={singleFolder}>
          <Icon name="folder" />
          <span>{singleFolder}</span>
        </div>
        <p className="duplicates-hero-desc" style={{ marginBottom: "1.25rem" }}>
          Pulsa 'Escanear duplicados' para comparar hashes exactos y similitud perceptual en todas las subcarpetas.
        </p>
        <div className="duplicates-ready-actions">
          <button
            type="button"
            className="duplicates-ready-scan-btn"
            onClick={handleStartScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Icon name="refresh" className="spin" />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Icon name="search" />
                <span>Escanear duplicados ahora</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="duplicates-ready-change-btn"
            onClick={handlePickSingleFolder}
          >
            <Icon name="edit" />
            <span>Cambiar carpeta</span>
          </button>
        </div>
      </div>
    );
  }

  if (scanMode === "two_folders") {
    return (
      <div className="duplicates-empty-view">
        <Icon name="copy" />
        <h3>Listo para comparar 2 carpetas</h3>
        <p>
          Selecciona la carpeta base a proteger y la carpeta a depurar arriba, luego pulsa 'Escanear duplicados'.
        </p>
      </div>
    );
  }

  return (
    <div className="duplicates-empty-view">
      <Icon name="copy" />
      <h3>Toda la biblioteca ({activeKind === "music" ? "Música" : activeKind === "image" ? "Imágenes" : "Vídeos"})</h3>
      <p>
        Pulsa 'Escanear duplicados' para analizar todas las carpetas registradas en la biblioteca.
      </p>
    </div>
  );
};

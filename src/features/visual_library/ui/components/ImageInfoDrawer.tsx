import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../../shared/ui/Icon";
import { cleanPath } from "../../../../shared/mediaTree";
import type { ImageExifData, VisualLibraryItem } from "../../model/types";
import "./image-info-drawer.css";

export interface ImageInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: VisualLibraryItem;
  onShowInFolder?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ImageInfoDrawer({
  isOpen,
  onClose,
  item,
  onShowInFolder,
}: ImageInfoDrawerProps) {
  const [exif, setExif] = useState<ImageExifData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    invoke<ImageExifData>("image_read_exif", { path: cleanPath(item.path) })
      .then((data) => {
        if (isMounted) {
          setExif(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Error leyendo metadatos EXIF:", err);
        if (isMounted) {
          setIsLoading(false);
          setExif(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item.path]);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(item.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenMap = () => {
    if (exif?.latitude && exif?.longitude) {
      const url = `https://www.google.com/maps?q=${exif.latitude},${exif.longitude}`;
      window.open(url, "_blank");
    }
  };

  if (!isOpen) return null;

  const hasCameraData = Boolean(
    exif?.cameraMake ||
      exif?.cameraModel ||
      exif?.lensModel ||
      exif?.aperture ||
      exif?.shutterSpeed ||
      exif?.iso ||
      exif?.focalLength
  );

  return (
    <aside
      className="image-info-drawer"
      aria-label="Panel de Información y EXIF"
      role="complementary"
    >
      {/* Cabecera del Panel */}
      <div className="image-info-drawer-header">
        <div className="image-info-drawer-title">
          <Icon name="info" />
          <span>Información de la Imagen</span>
        </div>
        <button
          type="button"
          className="image-info-close-btn"
          onClick={onClose}
          title="Cerrar información (I o Esc)"
        >
          <Icon name="close" />
        </button>
      </div>

      {/* Contenido con scroll */}
      <div className="image-info-drawer-body">
        {isLoading ? (
          <div className="image-info-loading">
            <Icon name="refresh" className="animate-spin" />
            <span>Leyendo metadatos EXIF...</span>
          </div>
        ) : (
          <>
            {/* 1. Ficha del Archivo */}
            <section className="image-info-section">
              <h3 className="image-info-section-title">
                <Icon name="file" />
                <span>Archivo</span>
              </h3>

              <div className="image-info-card">
                <div className="image-info-row">
                  <span className="image-info-label">Nombre</span>
                  <span className="image-info-value is-highlight" title={item.title}>
                    {item.title}
                  </span>
                </div>

                <div className="image-info-row">
                  <span className="image-info-label">Formato</span>
                  <span className="image-info-value image-info-badge">
                    {exif?.format || "IMAGEN"}
                  </span>
                </div>

                <div className="image-info-row">
                  <span className="image-info-label">Tamaño</span>
                  <span className="image-info-value">
                    {formatBytes(exif?.fileSizeBytes || item.sizeBytes)}
                  </span>
                </div>

                {exif && exif.width > 0 && (
                  <>
                    <div className="image-info-row">
                      <span className="image-info-label">Resolución</span>
                      <span className="image-info-value is-numeric">
                        {exif.width} × {exif.height} px
                      </span>
                    </div>

                    <div className="image-info-row">
                      <span className="image-info-label">Megapíxeles</span>
                      <span className="image-info-value is-numeric">
                        {exif.megapixels} MP ({exif.aspectRatio})
                      </span>
                    </div>
                  </>
                )}

                {exif?.dateTaken && (
                  <div className="image-info-row">
                    <span className="image-info-label">Fecha de toma</span>
                    <span className="image-info-value">{exif.dateTaken}</span>
                  </div>
                )}
              </div>

              {/* Acciones de ruta */}
              <div className="image-info-path-box">
                <span className="image-info-path-text" title={item.path}>
                  {item.path}
                </span>
                <div className="image-info-path-actions">
                  <button
                    type="button"
                    className="image-info-action-btn"
                    onClick={handleCopyPath}
                    title="Copiar ruta al portapapeles"
                  >
                    <Icon name={copied ? "check" : "copy"} />
                    <span>{copied ? "Copiada" : "Copiar"}</span>
                  </button>
                  {onShowInFolder && (
                    <button
                      type="button"
                      className="image-info-action-btn"
                      onClick={onShowInFolder}
                      title="Abrir carpeta contenedora en Windows"
                    >
                      <Icon name="folder-open" />
                      <span>Explorador</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Parámetros de Cámara y Óptica (si existen) */}
            {hasCameraData ? (
              <>
                <section className="image-info-section">
                  <h3 className="image-info-section-title">
                    <Icon name="camera" />
                    <span>Cámara y Lente</span>
                  </h3>

                  <div className="image-info-card">
                    {(exif?.cameraMake || exif?.cameraModel) && (
                      <div className="image-info-row">
                        <span className="image-info-label">Cámara</span>
                        <span className="image-info-value is-bold">
                          {exif.cameraMake && exif.cameraModel
                            ? exif.cameraModel.toLowerCase().includes(exif.cameraMake.toLowerCase())
                              ? exif.cameraModel
                              : `${exif.cameraMake} ${exif.cameraModel}`
                            : exif.cameraModel || exif.cameraMake}
                        </span>
                      </div>
                    )}

                    {exif?.lensModel && (
                      <div className="image-info-row">
                        <span className="image-info-label">Lente</span>
                        <span className="image-info-value">{exif.lensModel}</span>
                      </div>
                    )}

                    {exif?.software && (
                      <div className="image-info-row">
                        <span className="image-info-label">Software</span>
                        <span className="image-info-value is-subtle">{exif.software}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* 3. Parámetros de Exposición Fotográfica (Grid de Chips) */}
                <section className="image-info-section">
                  <h3 className="image-info-section-title">
                    <Icon name="sliders" />
                    <span>Ajustes de Exposición</span>
                  </h3>

                  <div className="image-info-chips-grid">
                    {exif?.aperture && (
                      <div className="image-info-chip" title="Apertura de diafragma (F-Number)">
                        <span className="chip-header">Apertura</span>
                        <span className="chip-highlight">{exif.aperture}</span>
                      </div>
                    )}

                    {exif?.shutterSpeed && (
                      <div className="image-info-chip" title="Velocidad de obturación">
                        <span className="chip-header">Obturador</span>
                        <span className="chip-highlight">{exif.shutterSpeed}</span>
                      </div>
                    )}

                    {exif?.iso && (
                      <div className="image-info-chip" title="Sensibilidad del sensor">
                        <span className="chip-header">ISO</span>
                        <span className="chip-highlight">ISO {exif.iso}</span>
                      </div>
                    )}

                    {exif?.focalLength && (
                      <div className="image-info-chip" title="Distancia focal">
                        <span className="chip-header">Focal</span>
                        <span className="chip-highlight">{exif.focalLength}</span>
                      </div>
                    )}

                    {exif?.exposureBias && (
                      <div className="image-info-chip" title="Compensación de exposición">
                        <span className="chip-header">Compensación</span>
                        <span className="chip-highlight">{exif.exposureBias}</span>
                      </div>
                    )}

                    {exif?.meteringMode && (
                      <div className="image-info-chip" title="Modo de medición de luz">
                        <span className="chip-header">Medición</span>
                        <span className="chip-highlight">{exif.meteringMode}</span>
                      </div>
                    )}

                    {exif?.flash && (
                      <div className="image-info-chip" title="Estado del flash">
                        <span className="chip-header">Flash</span>
                        <span className="chip-highlight">{exif.flash}</span>
                      </div>
                    )}

                    {exif?.whiteBalance && (
                      <div className="image-info-chip" title="Balance de blancos">
                        <span className="chip-header">B. Blancos</span>
                        <span className="chip-highlight">{exif.whiteBalance}</span>
                      </div>
                    )}

                    {exif?.colorSpace && (
                      <div className="image-info-chip" title="Perfil de color">
                        <span className="chip-header">Espacio Color</span>
                        <span className="chip-highlight">{exif.colorSpace}</span>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="image-info-no-exif">
                <Icon name="image" />
                <p>Sin metadatos de cámara</p>
                <span>Esta imagen no incluye etiquetas de captura fotográfica EXIF.</span>
              </div>
            )}

            {/* 4. Geolocalización GPS (si está disponible) */}
            {exif?.latitude && exif?.longitude && (
              <section className="image-info-section">
                <h3 className="image-info-section-title">
                  <Icon name="map-pin" />
                  <span>Ubicación GPS</span>
                </h3>

                <div className="image-info-card image-info-gps-card">
                  <div className="image-info-row">
                    <span className="image-info-label">Coordenadas</span>
                    <span className="image-info-value is-numeric">
                      {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="image-info-gps-btn"
                    onClick={handleOpenMap}
                  >
                    <Icon name="external-link" />
                    <span>Abrir en Google Maps</span>
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

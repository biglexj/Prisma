import { useEffect, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import type { ImageExifData } from "../../../tags/model/types";
import { tagsClient } from "../../../tags/tauri/client";

interface ExifDetailsModalProps {
  path: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExifDetailsModal({ path, isOpen, onClose }: ExifDetailsModalProps) {
  const [exif, setExif] = useState<ImageExifData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !path) return;
    setLoading(true);
    setError(null);

    tagsClient
      .readImageExif(path)
      .then(setExif)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [isOpen, path]);

  if (!isOpen) return null;

  return (
    <div className="tag-editor-backdrop" onClick={onClose}>
      <div className="tag-editor-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        <header className="tag-editor-header">
          <div className="tag-editor-header-info">
            <h2>Detalles y Metadatos EXIF</h2>
            <p>{exif?.file_name || path.replace(/.*[/\\]/, "")}</p>
          </div>
          <button className="tag-editor-close-btn" onClick={onClose} type="button">
            <Icon name="x" />
          </button>
        </header>

        <div className="tag-editor-body" style={{ gap: "1rem" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", opacity: 0.7 }}>
              <p>Leyendo metadatos fotográficos...</p>
            </div>
          ) : error ? (
            <div style={{ padding: "1rem", background: "rgba(242,184,181,0.15)", color: "#f2b8b5", borderRadius: "12px" }}>
              {error}
            </div>
          ) : exif ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Resumen fotográfico principal */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: "0.5rem",
                  background: "var(--surface-container, #282236)",
                  padding: "0.85rem",
                  borderRadius: "16px",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.72rem", opacity: 0.6, display: "block" }}>DIMENSIONES</span>
                  <strong style={{ fontSize: "0.95rem" }}>{exif.width} × {exif.height}</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.72rem", opacity: 0.6, display: "block" }}>MEGAPÍXELES</span>
                  <strong style={{ fontSize: "0.95rem" }}>{exif.megapixels} MP</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.72rem", opacity: 0.6, display: "block" }}>PROPORCIÓN</span>
                  <strong style={{ fontSize: "0.95rem" }}>{exif.aspect_ratio}</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.72rem", opacity: 0.6, display: "block" }}>FORMATO</span>
                  <strong style={{ fontSize: "0.95rem" }}>{exif.format}</strong>
                </div>
              </div>

              {/* Ficha técnica de cámara y disparo */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--primary, #d0bcff)" }}>
                  PARÁMETROS DE CAPTURA
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem 1rem",
                    fontSize: "0.88rem",
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Cámara</span>
                    <span>{exif.camera_make ? `${exif.camera_make} ${exif.camera_model || ""}` : (exif.camera_model || "No especificada")}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Objetivo / Lente</span>
                    <span>{exif.lens_model || "No especificado"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Apertura</span>
                    <span>{exif.aperture || "—"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Velocidad de Obturación</span>
                    <span>{exif.shutter_speed || "—"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Sensibilidad ISO</span>
                    <span>{exif.iso || "—"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Distancia Focal</span>
                    <span>{exif.focal_length || "—"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Fecha de captura</span>
                    <span>{exif.date_taken || "—"}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: "0.8rem", display: "block" }}>Software de procesado</span>
                    <span>{exif.software || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Ruta completa */}
              <div style={{ fontSize: "0.78rem", opacity: 0.7, wordBreak: "break-all" }}>
                <span style={{ display: "block", fontWeight: 600 }}>Ruta en disco:</span>
                <code>{exif.path}</code>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="tag-editor-footer">
          <button className="tag-editor-btn is-primary" onClick={onClose} type="button">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

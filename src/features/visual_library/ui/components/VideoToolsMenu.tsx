import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { DAVINCI_CLIP_COLORS } from "../../model/davinciColors";
import type { ClipColor, TakeStatus, VideoTakeMarker } from "../../model/types";

export interface VideoToolsMenuProps {
  onConvert: () => void;
  onShowInFolder: () => void;
  onSendToMobile: () => void;
  onCapture?: () => void;
  onCompare?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  marker?: VideoTakeMarker;
  onSelectStatus?: (status: TakeStatus) => void;
  onSelectColor?: (color: ClipColor) => void;
  onToggleHud?: () => void;
  hudVisible?: boolean;
}

export function VideoToolsMenu({
  onConvert,
  onShowInFolder,
  onSendToMobile,
  onCapture,
  onCompare,
  onOpenChange,
  marker,
  onSelectStatus,
  onSelectColor,
  onToggleHud,
  hudVisible,
}: VideoToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <div className="viewer-tools-dropdown-container" ref={menuRef}>
      <button
        className={`video-top-btn viewer-tools-trigger-btn ${isOpen ? "is-active" : ""}`}
        onClick={toggleMenu}
        title="Herramientas y opciones de vídeo"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Icon name="sliders" />
        <span>Herramientas</span>
        <Icon name="chevron-down" />
      </button>

      {isOpen && (
        <div className="viewer-tools-dropdown-panel" role="menu">
          <div className="viewer-tools-section">
            <div className="viewer-tools-section-title">Herramientas de Vídeo</div>

            {onCapture ? (
              <button
                className="viewer-tools-item"
                onClick={() => handleAction(onCapture)}
                role="menuitem"
              >
                <Icon name="camera" />
                <div className="viewer-tools-item-content">
                  <span className="viewer-tools-item-title">Capturar fotograma</span>
                  <span className="viewer-tools-item-desc">Guardar fotograma actual (Shift+S)</span>
                </div>
              </button>
            ) : null}

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onConvert)}
              role="menuitem"
            >
              <Icon name="refresh" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Convertidor</span>
                <span className="viewer-tools-item-desc">Convertir vídeo en Convertidor Prisma</span>
              </div>
            </button>

            {onCompare ? (
              <button
                className="viewer-tools-item"
                onClick={() => handleAction(onCompare)}
                role="menuitem"
              >
                <Icon name="compare" />
                <div className="viewer-tools-item-content">
                  <span className="viewer-tools-item-title">Comparar</span>
                  <span className="viewer-tools-item-desc">Comparar con otro vídeo</span>
                </div>
                <kbd className="viewer-tools-shortcut">C</kbd>
              </button>
            ) : null}

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onShowInFolder)}
              role="menuitem"
            >
              <Icon name="folder-open" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Mostrar en explorador</span>
                <span className="viewer-tools-item-desc">Abrir carpeta contenedora en Windows</span>
              </div>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onSendToMobile)}
              role="menuitem"
            >
              <Icon name="smartphone" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Enviar a Teléfono (Móvil)</span>
                <span className="viewer-tools-item-desc">Transmitir vídeo a Super Galería LAN</span>
              </div>
            </button>
          </div>

          {/* Sección: Workflow DaVinci / Clasificación de Tomas */}
          {(onSelectStatus || onToggleHud) && (
            <>
              <div className="viewer-tools-divider" />
              <div className="viewer-tools-section">
                <div className="viewer-tools-section-title">Clasificación de Toma (DaVinci)</div>

                {onSelectStatus && (
                  <div className="viewer-tools-take-grid">
                    <button
                      type="button"
                      className={`viewer-take-btn is-good ${marker?.status === "good_take" ? "is-selected" : ""}`}
                      onClick={() => onSelectStatus(marker?.status === "good_take" ? "pending" : "good_take")}
                      title="Marcar como Buena Toma (Atajo 1)"
                    >
                      <Icon name="check" width={12} height={12} />
                      <span>Buena</span>
                      <kbd>1</kbd>
                    </button>

                    <button
                      type="button"
                      className={`viewer-take-btn is-reject ${marker?.status === "reject" ? "is-selected" : ""}`}
                      onClick={() => onSelectStatus(marker?.status === "reject" ? "pending" : "reject")}
                      title="Marcar como Descarte (Atajo 2)"
                    >
                      <Icon name="close" width={12} height={12} />
                      <span>Descarte</span>
                      <kbd>2</kbd>
                    </button>

                    <button
                      type="button"
                      className={`viewer-take-btn is-broll ${marker?.status === "b_roll" ? "is-selected" : ""}`}
                      onClick={() => onSelectStatus(marker?.status === "b_roll" ? "pending" : "b_roll")}
                      title="Marcar como B-Roll (Atajo 3)"
                    >
                      <Icon name="film" width={12} height={12} />
                      <span>B-Roll</span>
                      <kbd>3</kbd>
                    </button>

                    {marker?.status && marker.status !== "pending" && (
                      <button
                        type="button"
                        className="viewer-take-btn is-reset"
                        onClick={() => onSelectStatus("pending")}
                        title="Quitar marca (Atajo 0)"
                      >
                        <Icon name="rotate-ccw" width={12} height={12} />
                        <kbd>0</kbd>
                      </button>
                    )}
                  </div>
                )}

                {onSelectColor && (
                  <div className="viewer-tools-color-wrapper">
                    <div className="viewer-tools-sublabel">Color de Clip DaVinci</div>
                    <div className="viewer-tools-color-row">
                      {DAVINCI_CLIP_COLORS.map((col) => {
                        const isSelected = marker?.clip_color === col.id;
                        return (
                          <button
                            key={col.id}
                            type="button"
                            className={`viewer-color-circle ${isSelected ? "is-selected" : ""}`}
                            style={{ backgroundColor: col.hex }}
                            onClick={() => onSelectColor(isSelected ? "none" : col.id)}
                            title={col.label}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {onToggleHud && (
                  <button
                    className={`viewer-tools-item ${hudVisible ? "is-active" : ""}`}
                    onClick={() => handleAction(onToggleHud)}
                    role="menuitem"
                  >
                    <Icon name="info" />
                    <div className="viewer-tools-item-content">
                      <span className="viewer-tools-item-title">
                        {hudVisible ? "Ocultar Ficha Técnica" : "Ficha Técnica · Telemetría"}
                      </span>
                      <span className="viewer-tools-item-desc">Códec, fps exactos, resolución y Log</span>
                    </div>
                    <kbd className="viewer-tools-shortcut">I</kbd>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";

export interface VideoToolsMenuProps {
  onConvert: () => void;
  onShowInFolder: () => void;
  onSendToMobile: () => void;
  onCapture?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
}

export function VideoToolsMenu({
  onConvert,
  onShowInFolder,
  onSendToMobile,
  onCapture,
  onOpenChange,
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
        </div>
      )}
    </div>
  );
}

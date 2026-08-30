import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";

export interface ViewerToolsMenuProps {
  onEdit: () => void;
  onCompare: () => void;
  onConvert: () => void;
  onRename: () => void;
  onShowInfo: () => void;
  onDetach: () => void;
  onShowInFolder: () => void;
  onSendToMobile: () => void;
  isSlideshowActive: boolean;
  onToggleSlideshow: () => void;
  onOpenChange?: (isOpen: boolean) => void;
}

export function ViewerToolsMenu({
  onEdit,
  onCompare,
  onConvert,
  onRename,
  onShowInfo,
  onDetach,
  onShowInFolder,
  onSendToMobile,
  isSlideshowActive,
  onToggleSlideshow,
  onOpenChange,
}: ViewerToolsMenuProps) {
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
        className={`image-viewer-top-btn viewer-tools-trigger-btn ${isOpen ? "is-active" : ""}`}
        onClick={toggleMenu}
        title="Herramientas y opciones de imagen"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Icon name="sliders" />
        <span>Herramientas</span>
        <Icon name="chevron-down" />
      </button>

      {isOpen && (
        <div className="viewer-tools-dropdown-panel" role="menu">
          {/* Sección de Edición & Conversión */}
          <div className="viewer-tools-section">
            <div className="viewer-tools-section-title">Edición y Conversión</div>
            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onEdit)}
              role="menuitem"
            >
              <Icon name="crop" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Editar imagen</span>
                <span className="viewer-tools-item-desc">Recortar, rotar y filtros</span>
              </div>
              <kbd className="viewer-tools-shortcut">E</kbd>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onConvert)}
              role="menuitem"
            >
              <Icon name="refresh" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Convertidor</span>
                <span className="viewer-tools-item-desc">Convertir formato en Convertidor Prisma</span>
              </div>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onCompare)}
              role="menuitem"
            >
              <Icon name="compare" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Comparar</span>
                <span className="viewer-tools-item-desc">Comparar con otra imagen</span>
              </div>
              <kbd className="viewer-tools-shortcut">C</kbd>
            </button>
          </div>

          <div className="viewer-tools-divider" />

          {/* Sección de Gestión */}
          <div className="viewer-tools-section">
            <div className="viewer-tools-section-title">Gestión y Archivo</div>
            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onShowInfo)}
              role="menuitem"
            >
              <Icon name="info" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Información y EXIF</span>
                <span className="viewer-tools-item-desc">Detalles técnicos del archivo y cámara</span>
              </div>
              <kbd className="viewer-tools-shortcut">I</kbd>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onRename)}
              role="menuitem"
            >
              <Icon name="edit" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Renombrar</span>
                <span className="viewer-tools-item-desc">Cambiar nombre del archivo</span>
              </div>
              <kbd className="viewer-tools-shortcut">F2</kbd>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onDetach)}
              role="menuitem"
            >
              <Icon name="copy" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Abrir en otra instancia</span>
                <span className="viewer-tools-item-desc">Ver en ventana independiente a la par</span>
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
                <span className="viewer-tools-item-desc">Abrir carpeta en Windows</span>
              </div>
            </button>

            <button
              className="viewer-tools-item"
              onClick={() => handleAction(onSendToMobile)}
              role="menuitem"
            >
              <Icon name="smartphone" />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">Enviar a Móvil</span>
                <span className="viewer-tools-item-desc">Proyectar en Super Galería LAN</span>
              </div>
            </button>
          </div>

          <div className="viewer-tools-divider" />

          {/* Sección de Proyección */}
          <div className="viewer-tools-section">
            <div className="viewer-tools-section-title">Proyección</div>
            <button
              className={`viewer-tools-item ${isSlideshowActive ? "is-active" : ""}`}
              onClick={() => handleAction(onToggleSlideshow)}
              role="menuitem"
            >
              <Icon name={isSlideshowActive ? "pause" : "play"} />
              <div className="viewer-tools-item-content">
                <span className="viewer-tools-item-title">
                  {isSlideshowActive ? "Detener presentación" : "Iniciar presentación"}
                </span>
                <span className="viewer-tools-item-desc">Pase automático de fotos</span>
              </div>
              <kbd className="viewer-tools-shortcut">Espacio</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

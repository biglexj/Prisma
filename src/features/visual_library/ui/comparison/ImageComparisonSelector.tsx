import { useState, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../../shared/ui/Icon";
import { cleanPath } from "../../../../shared/mediaTree";
import type { VisualLibraryItem } from "../../model/types";

interface ImageComparisonSelectorProps {
  currentItems: VisualLibraryItem[];
  availableItems: VisualLibraryItem[];
  onSelect: (item: VisualLibraryItem) => void;
  onSelectMultiple?: (items: VisualLibraryItem[]) => void;
  onClose: () => void;
  title?: string;
  maxSelectable?: number;
}

export function ImageComparisonSelector({
  currentItems,
  availableItems,
  onSelect,
  onSelectMultiple,
  onClose,
  title = "Seleccionar imagen para comparar",
  maxSelectable = 1,
}: ImageComparisonSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const currentPathSet = useMemo(
    () => new Set(currentItems.map((it) => it.path)),
    [currentItems],
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableItems;
    return availableItems.filter(
      (it) =>
        it.title.toLowerCase().includes(term) ||
        it.path.toLowerCase().includes(term),
    );
  }, [availableItems, searchTerm]);

  const handleBrowseCustomFile = async () => {
    try {
      const selected = await open({
        multiple: maxSelectable > 1,
        filters: [
          {
            name: "Imágenes",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif"],
          },
        ],
      });

      if (!selected) return;

      const filePaths: string[] = Array.isArray(selected)
        ? selected
        : typeof selected === "string"
          ? [selected]
          : [];

      if (filePaths.length === 0) return;

      const newItems: VisualLibraryItem[] = filePaths.map((p) => {
        const fileName = p.replace(/\\/g, "/").split("/").pop() || "Imagen";
        return {
          path: p,
          title: fileName,
          sourcePath: p,
          relativeFolder: "",
          kind: "image",
          modifiedAtMillis: Date.now(),
          sizeBytes: 0,
        };
      });

      if (maxSelectable > 1 && onSelectMultiple && newItems.length > 1) {
        onSelectMultiple(newItems);
      } else if (newItems[0]) {
        onSelect(newItems[0]);
      }
    } catch {}
  };

  const handleToggleItem = (item: VisualLibraryItem) => {
    if (maxSelectable <= 1) {
      onSelect(item);
      return;
    }

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(item.path)) {
        next.delete(item.path);
      } else {
        if (next.size >= maxSelectable) return prev;
        next.add(item.path);
      }
      return next;
    });
  };

  const handleConfirmMulti = () => {
    if (!onSelectMultiple) return;
    const selectedList = availableItems.filter((it) =>
      selectedPaths.has(it.path),
    );
    if (selectedList.length > 0) {
      onSelectMultiple(selectedList);
    }
  };

  return (
    <div className="img-compare-selector-backdrop" onClick={onClose}>
      <div
        className="img-compare-selector-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="img-compare-selector-header">
          <div className="img-compare-selector-title-wrap">
            <span className="img-compare-selector-icon">
              <Icon name="compare" />
            </span>
            <h3>{title}</h3>
          </div>
          <button
            className="img-compare-selector-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="img-compare-selector-toolbar">
          <div className="img-compare-search-wrap">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Buscar en esta carpeta / biblioteca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button
                className="img-compare-search-clear"
                onClick={() => setSearchTerm("")}
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <button
            type="button"
            className="img-compare-browse-btn"
            onClick={handleBrowseCustomFile}
            title="Seleccionar otra imagen desde cualquier carpeta del equipo"
          >
            <Icon name="folder-open" />
            <span>Examinar archivo...</span>
          </button>
        </div>

        <div className="img-compare-selector-grid">
          {filteredItems.length === 0 ? (
            <div className="img-compare-selector-empty">
              <Icon name="image" />
              <p>No se encontraron imágenes coincidentes.</p>
              <button
                type="button"
                className="img-compare-browse-btn is-primary"
                onClick={handleBrowseCustomFile}
              >
                <Icon name="folder-open" />
                <span>Examinar archivo desde el equipo</span>
              </button>
            </div>
          ) : (
            filteredItems.map((it) => {
              const isAlreadyCurrent = currentPathSet.has(it.path);
              const isSelected = selectedPaths.has(it.path);

              return (
                <button
                  key={it.path}
                  type="button"
                  className={`img-compare-grid-item ${isAlreadyCurrent ? "is-current" : ""} ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleToggleItem(it)}
                  title={it.title}
                >
                  <div className="img-compare-item-thumb">
                    <img
                      src={convertFileSrc(cleanPath(it.path))}
                      alt={it.title}
                      loading="lazy"
                      draggable={false}
                    />
                    {isAlreadyCurrent && (
                      <span className="img-compare-item-badge">En uso</span>
                    )}
                    {isSelected && (
                      <span className="img-compare-item-check">
                        <Icon name="check" />
                      </span>
                    )}
                  </div>
                  <span className="img-compare-item-name">{it.title}</span>
                </button>
              );
            })
          )}
        </div>

        {maxSelectable > 1 && selectedPaths.size > 0 && (
          <footer className="img-compare-selector-footer">
            <span>{selectedPaths.size} seleccionada(s)</span>
            <div className="img-compare-footer-actions">
              <button
                type="button"
                className="img-compare-btn-cancel"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="img-compare-btn-confirm"
                onClick={handleConfirmMulti}
              >
                Comparar {selectedPaths.size} imágenes
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

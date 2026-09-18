import { useState, useMemo, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Icon } from "../../../shared/ui/Icon";
import { cleanPath } from "../../../shared/mediaTree";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import {
  isSupportedMediaPath,
  createVisualItemFromPath,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_ALL_MEDIA_EXTENSIONS,
} from "../model/types";

interface ImageComparisonSelectorProps {
  currentItems: VisualLibraryItem[];
  availableItems: VisualLibraryItem[];
  onSelect: (item: VisualLibraryItem) => void;
  onSelectMultiple?: (items: VisualLibraryItem[]) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxSelectable?: number;
}

interface FolderEntry {
  key: string;
  name: string;
  count: number;
}

function getItemFolderInfo(item: VisualLibraryItem): { key: string; name: string } {
  if (item.relativeFolder && item.relativeFolder.trim() !== "") {
    const cleanRel = cleanPath(item.relativeFolder);
    const parts = cleanRel.replace(/\\/g, "/").split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || cleanRel;
    return { key: cleanRel, name: lastPart };
  }
  const normalized = item.path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const parent = segments[segments.length - 2];
    const parentDir = segments.slice(0, -1).join("/");
    return { key: parentDir, name: parent };
  }
  return { key: "root", name: "Carpeta principal" };
}

const BATCH_SIZE = 60;

export function ImageComparisonSelector({
  currentItems,
  availableItems,
  onSelect,
  onSelectMultiple,
  onClose,
  title = "Seleccionar imagen para comparar",
  subtitle,
  maxSelectable = 1,
}: ImageComparisonSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [mediaKindFilter, setMediaKindFilter] = useState<"all" | "image" | "video">("all");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isDragOver, setIsDragOver] = useState(false);

  // Escucha de drag & drop nativo de Tauri v2
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    listen<{ paths?: string[] }>("prisma://native-drag-drop", (event) => {
      if (isCancelled) return;
      setIsDragOver(false);
      const paths = event.payload?.paths;
      if (paths && paths.length > 0) {
        const mediaPaths = paths.filter(isSupportedMediaPath);
        if (mediaPaths.length > 0) {
          const newItems = mediaPaths.map(createVisualItemFromPath);
          if (maxSelectable > 1 && onSelectMultiple && newItems.length > 1) {
            onSelectMultiple(newItems);
          } else if (newItems[0]) {
            onSelect(newItems[0]);
          }
        }
      }
    }).then((u) => {
      if (isCancelled) u();
      else unlistens.push(u);
    }).catch(() => {});

    listen("prisma://native-drag-enter", () => {
      if (!isCancelled) setIsDragOver(true);
    }).then((u) => {
      if (isCancelled) u();
      else unlistens.push(u);
    }).catch(() => {});

    listen("prisma://native-drag-leave", () => {
      if (!isCancelled) setIsDragOver(false);
    }).then((u) => {
      if (isCancelled) u();
      else unlistens.push(u);
    }).catch(() => {});

    return () => {
      isCancelled = true;
      unlistens.forEach((u) => u());
    };
  }, [maxSelectable, onSelect, onSelectMultiple]);

  const currentPathSet = useMemo(
    () => new Set(currentItems.map((it) => it.path)),
    [currentItems],
  );

  // Filter available items by media kind (all / image / video)
  const itemsByKind = useMemo(() => {
    if (mediaKindFilter === "all") return availableItems;
    return availableItems.filter((it) => it.kind === mediaKindFilter);
  }, [availableItems, mediaKindFilter]);

  // Group items by folders
  const { folderEntries, folderItemMap } = useMemo(() => {
    const map = new Map<string, VisualLibraryItem[]>();
    const nameMap = new Map<string, string>();

    for (const it of itemsByKind) {
      const { key, name } = getItemFolderInfo(it);
      nameMap.set(key, name);
      const list = map.get(key);
      if (list) {
        list.push(it);
      } else {
        map.set(key, [it]);
      }
    }

    const entries: FolderEntry[] = Array.from(map.entries()).map(([key, items]) => ({
      key,
      name: nameMap.get(key) || key,
      count: items.length,
    }));

    entries.sort((a, b) => b.count - a.count);
    return { folderEntries: entries, folderItemMap: map };
  }, [itemsByKind]);

  // Determine initial folder based on the primary image being viewed
  const initialFolderKey = useMemo(() => {
    if (currentItems.length > 0) {
      const currentFolder = getItemFolderInfo(currentItems[0]);
      if (folderItemMap.has(currentFolder.key)) {
        return currentFolder.key;
      }
    }
    return folderEntries[0]?.key || "ALL";
  }, [currentItems, folderItemMap, folderEntries]);

  const [selectedFolderKey, setSelectedFolderKey] = useState<string>(initialFolderKey);

  // Reset pagination when folder or search query changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedFolderKey, searchTerm, mediaKindFilter]);

  // Filter items by folder
  const itemsInSelectedFolder = useMemo(() => {
    if (selectedFolderKey === "ALL") {
      return itemsByKind;
    }
    return folderItemMap.get(selectedFolderKey) || itemsByKind;
  }, [selectedFolderKey, folderItemMap, itemsByKind]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return itemsInSelectedFolder;
    return itemsInSelectedFolder.filter(
      (it) =>
        it.title.toLowerCase().includes(term) ||
        it.path.toLowerCase().includes(term),
    );
  }, [itemsInSelectedFolder, searchTerm]);

  // Check if matches exist across ALL folders when 0 matches in current folder
  const globalMatchesCount = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || selectedFolderKey === "ALL") return 0;
    return itemsByKind.filter(
      (it) =>
        it.title.toLowerCase().includes(term) ||
        it.path.toLowerCase().includes(term),
    ).length;
  }, [itemsByKind, searchTerm, selectedFolderKey]);

  // Windowed display list for ultra-smooth 60fps rendering
  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 240) {
      if (visibleCount < filteredItems.length) {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredItems.length));
      }
    }
  };

  const handleBrowseCustomFile = async () => {
    try {
      const selected = await open({
        multiple: maxSelectable > 1,
        filters: [
          {
            name: "Multimedia (Fotos y Vídeos)",
            extensions: SUPPORTED_ALL_MEDIA_EXTENSIONS,
          },
          {
            name: "Imágenes",
            extensions: SUPPORTED_IMAGE_EXTENSIONS,
          },
          {
            name: "Vídeos",
            extensions: SUPPORTED_VIDEO_EXTENSIONS,
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

      const newItems: VisualLibraryItem[] = filePaths.map(createVisualItemFromPath);

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

  const handleHtmlDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleHtmlDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleHtmlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .map((f) => (f as unknown as { path?: string }).path)
        .filter((p): p is string => Boolean(p && isSupportedMediaPath(p)));
      if (paths.length > 0) {
        const newItems = paths.map(createVisualItemFromPath);
        if (maxSelectable > 1 && onSelectMultiple && newItems.length > 1) {
          onSelectMultiple(newItems);
        } else if (newItems[0]) {
          onSelect(newItems[0]);
        }
      }
    }
  };

  return (
    <div className="img-compare-selector-backdrop" onClick={onClose}>
      <div
        className={`img-compare-selector-modal ${isDragOver ? "is-drag-over" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        onDragOver={handleHtmlDragOver}
        onDragEnter={handleHtmlDragOver}
        onDragLeave={handleHtmlDragLeave}
        onDrop={handleHtmlDrop}
      >
        {isDragOver && (
          <div className="img-compare-selector-drag-overlay">
            <div className="img-compare-drag-glow-box">
              <Icon name="download" />
              <h3>¡Suelta la imagen o vídeo aquí!</h3>
              <p>Se añadirá inmediatamente a la comparativa</p>
            </div>
          </div>
        )}

        <header className="img-compare-selector-header">
          <div className="img-compare-selector-title-wrap">
            <span className="img-compare-selector-icon">
              <Icon name="compare" />
            </span>
            <div>
              <h3>{title}</h3>
              {subtitle && <p className="img-compare-selector-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            className="img-compare-selector-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <Icon name="close" />
          </button>
        </header>

        {/* Toolbar con buscador, filtro de medio y botón de examinar */}
        <div className="img-compare-selector-toolbar">
          <div className="img-compare-search-wrap">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Buscar en esta carpeta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button
                className="img-compare-search-clear"
                onClick={() => setSearchTerm("")}
                title="Limpiar búsqueda"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="img-compare-kind-pills">
            <button
              type="button"
              className={`img-compare-kind-pill ${mediaKindFilter === "all" ? "is-active" : ""}`}
              onClick={() => setMediaKindFilter("all")}
            >
              <span>Todo</span>
            </button>
            <button
              type="button"
              className={`img-compare-kind-pill ${mediaKindFilter === "image" ? "is-active" : ""}`}
              onClick={() => setMediaKindFilter("image")}
            >
              <Icon name="image" />
              <span>Fotos</span>
            </button>
            <button
              type="button"
              className={`img-compare-kind-pill ${mediaKindFilter === "video" ? "is-active" : ""}`}
              onClick={() => setMediaKindFilter("video")}
            >
              <Icon name="video" />
              <span>Vídeos</span>
            </button>
          </div>

          <button
            type="button"
            className="img-compare-browse-btn"
            onClick={handleBrowseCustomFile}
            title="Seleccionar otra imagen o vídeo desde cualquier carpeta del equipo"
          >
            <Icon name="folder-open" />
            <span>Examinar archivo...</span>
          </button>
        </div>

        {/* Filtro por carpetas (Tabs / Pills) */}
        {folderEntries.length > 0 && (
          <div className="img-compare-folder-bar">
            <span className="img-compare-folder-label">
              <Icon name="folder" />
              <span>Carpeta:</span>
            </span>
            <div className="img-compare-folder-pills">
              {folderEntries.map((folder) => {
                const isActive = selectedFolderKey === folder.key;
                return (
                  <button
                    key={folder.key}
                    type="button"
                    className={`img-compare-folder-pill ${isActive ? "is-active" : ""}`}
                    onClick={() => setSelectedFolderKey(folder.key)}
                    title={`${folder.name} (${folder.count} fotos)`}
                  >
                    <span>{folder.name}</span>
                    <span className="img-compare-pill-count">{folder.count}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`img-compare-folder-pill ${selectedFolderKey === "ALL" ? "is-active" : ""}`}
                onClick={() => setSelectedFolderKey("ALL")}
                title={`Mostrar todas las fotos de la biblioteca (${availableItems.length})`}
              >
                <span>Todas las carpetas</span>
                <span className="img-compare-pill-count">{availableItems.length}</span>
              </button>
            </div>
          </div>
        )}

        {/* Rejilla de miniaturas ultrarrápidas con VisualThumbnail */}
        <div className="img-compare-selector-grid" onScroll={handleGridScroll}>
          {filteredItems.length === 0 ? (
            <div className="img-compare-selector-empty">
              <Icon name="image" />
              <p>No se encontraron imágenes en esta carpeta.</p>
              {globalMatchesCount > 0 && (
                <button
                  type="button"
                  className="img-compare-browse-btn is-primary"
                  onClick={() => setSelectedFolderKey("ALL")}
                >
                  <Icon name="search" />
                  <span>Ver {globalMatchesCount} resultado(s) en todas las carpetas</span>
                </button>
              )}
              <button
                type="button"
                className="img-compare-browse-btn"
                onClick={handleBrowseCustomFile}
              >
                <Icon name="folder-open" />
                <span>Examinar archivo desde el equipo</span>
              </button>
            </div>
          ) : (
            displayedItems.map((it) => {
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
                    <VisualThumbnail
                      path={it.path}
                      alt={it.title}
                      className="img-compare-thumbnail-media"
                      fit="cover"
                    />
                    {isAlreadyCurrent && (
                      <span className="img-compare-item-badge">En comparativa</span>
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

          {/* Indicador y botón de carga progresiva si hay más elementos */}
          {visibleCount < filteredItems.length && (
            <div className="img-compare-load-more">
              <span>
                Mostrando {displayedItems.length} de {filteredItems.length} fotos
              </span>
              <button
                type="button"
                className="img-compare-btn-load-more"
                onClick={() =>
                  setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredItems.length))
                }
              >
                Cargar más fotos ({filteredItems.length - displayedItems.length} restantes)
              </button>
            </div>
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

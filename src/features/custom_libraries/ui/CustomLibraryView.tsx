import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import type {
  CustomLibraryDefinition,
  CustomLibraryFolderSource,
  CustomLibraryItem,
} from "../model/types";
import {
  customLibrariesAddFolder,
  customLibrariesGetFolders,
  customLibrariesGetThumbnail,
  customLibrariesOpenFile,
  customLibrariesScanItems,
} from "../tauri/client";
import { DocumentViewer } from "./DocumentViewer";
import "./custom-library.css";

type ViewMode = "timeline" | "folders" | "tree";
export type CustomSortField = "date" | "name" | "size" | "random";
export type CustomSortDirection = "desc" | "asc";

interface CustomLibraryViewProps {
  definition: CustomLibraryDefinition;
  onOpenFolders: () => void;
  confirmDeletion?: boolean;
  searchQuery?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function getFileIcon(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "file-text";
    case "epub":
    case "mobi":
    case "cbz":
    case "cbr":
      return "book-open";
    case "kra":
    case "krz":
    case "ora":
      return "palette";
    case "af":
    case "afphoto":
    case "afdesign":
    case "afpub":
    case "aftemplate":
    case "psd":
    case "psb":
    case "ai":
      return "layers";
    case "drp":
    case "dra":
      return "film";
    case "blend":
    case "obj":
    case "fbx":
      return "box";
    case "md":
    case "markdown":
      return "file-code";
    default:
      return "file";
  }
}

const THUMBNAIL_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico", "avif", "tiff", "tif",
  "pdf", "kra", "krz", "ora", "af", "afphoto", "afdesign", "afpub", "aftemplate",
  "psd", "psb", "ai", "mp4", "mkv", "avi", "mov", "webm",
]);

const thumbnailCache = new Map<string, string | null>();

function CustomThumbnailItem({
  item,
  onClick,
  onContextMenu,
}: {
  item: CustomLibraryItem;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const ext = item.extension.toLowerCase();
  const supportsThumb = THUMBNAIL_EXTENSIONS.has(ext);

  const [thumb, setThumb] = useState<string | null>(() => {
    if (!supportsThumb) return null;
    return thumbnailCache.get(item.path) ?? null;
  });

  useEffect(() => {
    if (!supportsThumb) return;

    if (thumbnailCache.has(item.path)) {
      setThumb(thumbnailCache.get(item.path) ?? null);
      return;
    }

    let isMounted = true;
    void customLibrariesGetThumbnail(item.path).then((data) => {
      thumbnailCache.set(item.path, data);
      if (isMounted) {
        setThumb(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [item.path, supportsThumb]);

  return (
    <div
      className="custom-card"
      key={item.path}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={item.path}
    >
      <div className="custom-card-preview">
        {thumb ? (
          <img alt={item.name} loading="lazy" src={thumb} />
        ) : (
          <div className="custom-card-fallback-icon">
            <Icon name={getFileIcon(item.extension) as any} />
          </div>
        )}
        <span className="custom-card-ext-badge">.{item.extension}</span>
      </div>
      <div className="custom-card-body">
        <span className="custom-card-title" title={item.name}>{item.name}</span>
        <div className="custom-card-meta">
          <span>{formatBytes(item.sizeBytes)}</span>
          {item.relativeFolder ? <span>• {item.relativeFolder}</span> : null}
        </div>
      </div>
    </div>
  );
}

interface CustomLibrarySessionData {
  items: CustomLibraryItem[];
  folders: CustomLibraryFolderSource[];
  loaded: boolean;
  viewMode: ViewMode;
  folderPath: string;
  sortField: CustomSortField;
  sortDirection: CustomSortDirection;
}

const customLibrarySessionCache = new Map<string, CustomLibrarySessionData>();

function getSessionData(id: string): CustomLibrarySessionData {
  let cached = customLibrarySessionCache.get(id);
  if (!cached) {
    cached = {
      items: [],
      folders: [],
      loaded: false,
      viewMode: "timeline",
      folderPath: "",
      sortField: "date",
      sortDirection: "desc",
    };
    customLibrarySessionCache.set(id, cached);
  }
  return cached;
}

export function CustomLibraryView({
  definition,
  onOpenFolders,
  confirmDeletion = true,
  searchQuery = "",
}: CustomLibraryViewProps) {
  const session = getSessionData(definition.id);
  const [items, setItems] = useState<CustomLibraryItem[]>(() => session.items);
  const [folders, setFolders] = useState<CustomLibraryFolderSource[]>(() => session.folders);
  const [loading, setLoading] = useState(!session.loaded);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocItem, setSelectedDocItem] = useState<CustomLibraryItem | null>(null);

  const [viewMode, setViewModeState] = useState<ViewMode>(() => session.viewMode);
  const [currentFolderPath, setCurrentFolderPathState] = useState<string>(() => session.folderPath);
  const [sortField, setSortFieldState] = useState<CustomSortField>(() => session.sortField);
  const [sortDirection, setSortDirectionState] = useState<CustomSortDirection>(() => session.sortDirection);
  const [randomSeed, setRandomSeed] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const setViewMode = (mode: ViewMode) => {
    session.viewMode = mode;
    setViewModeState(mode);
  };

  const setCurrentFolderPath = (path: string) => {
    session.folderPath = path;
    setCurrentFolderPathState(path);
  };

  const setSortField = (field: CustomSortField) => {
    session.sortField = field;
    setSortFieldState(field);
  };

  const setSortDirection = (dir: CustomSortDirection) => {
    session.sortDirection = dir;
    setSortDirectionState(dir);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (silent = false) => {
    try {
      if (!silent && !session.loaded) {
        setLoading(true);
      }
      setError(null);
      const [scanned, folderSources] = await Promise.all([
        customLibrariesScanItems(definition.id),
        customLibrariesGetFolders(definition.id),
      ]);
      setItems(scanned);
      setFolders(folderSources);
      session.items = scanned;
      session.folders = folderSources;
      session.loaded = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(session.loaded);
  }, [definition.id, definition.folderPaths, definition.excludedFolderPaths]);

  const mediaDelete = useMediaDelete({
    confirmDeletion,
    onRefresh: () => void loadData(true),
    onDeleted: (deletedItem) => {
      setItems((prev) => {
        const next = prev.filter((it) => it.path !== deletedItem.path);
        session.items = next;
        return next;
      });
    },
  });

  const handleManualRefresh = async () => {
    if (isRefreshing || loading) return;
    setIsRefreshing(true);
    try {
      await loadData(true);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 400);
    }
  };

  // Cerrar menú de ordenación al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSortMenu]);

  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: `Añadir carpeta para ${definition.label}`,
    });
    if (typeof selection === "string") {
      await customLibrariesAddFolder(definition.id, selection);
      await loadData();
    }
  };

  const handleOpenFile = (item: CustomLibraryItem) => {
    setSelectedDocItem(item);
  };

  // Filtrado y Ordenación de elementos
  const displayedItems = useMemo(() => {
    let list = [...items];
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) => it.name.toLowerCase().includes(q) || it.relativeFolder.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = (a.modifiedTimestamp || 0) - (b.modifiedTimestamp || 0);
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "size") {
        comparison = a.sizeBytes - b.sizeBytes;
      } else if (sortField === "random") {
        comparison = (a.path.length % 7) - (b.path.length % 7);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return list;
  }, [items, searchQuery, sortField, sortDirection, randomSeed]);

  // Solo para la vista de Tiempo se excluyen las carpetas ocultas
  const timelineItems = useMemo(() => {
    return displayedItems.filter((it) => !it.isExcluded);
  }, [displayedItems]);

  // Colecciones por carpetas
  const folderCollections = useMemo(() => {
    const map = new Map<string, CustomLibraryItem[]>();
    for (const item of displayedItems) {
      const folderKey = item.relativeFolder || "Raíz";
      const existing = map.get(folderKey) || [];
      existing.push(item);
      map.set(folderKey, existing);
    }
    return Array.from(map.entries()).map(([folderPath, groupItems]) => ({
      folderPath,
      folderName: folderPath === "Raíz" ? "Raíz" : folderPath.split("/").pop() || folderPath,
      items: groupItems,
    }));
  }, [displayedItems]);

  const currentCollection = useMemo(() => {
    if (!currentFolderPath) return null;
    return folderCollections.find((c) => c.folderPath === currentFolderPath) || null;
  }, [folderCollections, currentFolderPath]);

  const [folderMenu, setFolderMenu] = useState<{
    x: number;
    y: number;
    col: { folderPath: string; folderName: string; items: CustomLibraryItem[] };
  } | null>(null);

  const handleFolderContextMenu = (
    e: React.MouseEvent,
    col: { folderPath: string; folderName: string; items: CustomLibraryItem[] }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderMenu({
      x: e.clientX,
      y: e.clientY,
      col,
    });
  };

  const buildFolderMenuItems = () => {
    if (!folderMenu) return [];
    const col = folderMenu.col;
    const itemsCount = col.items.length;
    const firstItem = col.items[0];

    const menuItems = [];

    // 1. Convertir
    if (itemsCount > 0) {
      menuItems.push({
        id: "convert-folder",
        label: `Convertir ${itemsCount} ${itemsCount === 1 ? "archivo" : "archivos"} en Convertidor Prisma`,
        icon: "refresh" as const,
        onSelect: () => {
          const paths = col.items.map((it) => it.path);
          window.dispatchEvent(
            new CustomEvent("prisma-open-converter", {
              detail: {
                paths,
                mode: "image",
              },
            })
          );
        },
      });
    }

    // 2. Renombrar carpeta en Renombrador
    if (itemsCount > 0 && col.folderPath) {
      menuItems.push({
        id: "rename-folder",
        label: `Renombrar ${itemsCount} ${itemsCount === 1 ? "archivo" : "archivos"} en Renombrador`,
        icon: "edit" as const,
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent("prisma-open-renamer", {
              detail: {
                folderPath: col.folderPath,
                filterMode: "all",
              },
            })
          );
        },
      });
    }

    // 3. Abrir carpeta
    menuItems.push({
      id: "open-folder",
      label: "Abrir y explorar carpeta",
      icon: "folder-open" as const,
      onSelect: () => setCurrentFolderPath(col.folderPath),
    });

    // 4. Mostrar en explorador
    if (firstItem) {
      menuItems.push({
        id: "show-in-explorer",
        label: "Mostrar en explorador de archivos",
        icon: "folder" as const,
        onSelect: () => {
          void invoke("show_in_file_manager", { path: firstItem.path }).catch(() => {});
        },
      });
    }

    return menuItems;
  };

  const buildMenuItems = () => {
    const target = mediaDelete.menu;
    if (!target) return [];
    return [
      {
        id: "open",
        label: `Abrir con ${definition.externalAppCommand || "aplicación predeterminada"}`,
        icon: "external-link" as const,
        onSelect: () => void customLibrariesOpenFile(target.item.path, definition.externalAppCommand),
      },
      {
        id: "convert",
        label: "Convertir en Convertidor Prisma",
        icon: "refresh" as const,
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent("prisma-open-converter", {
              detail: {
                path: target.item.path,
                mode: "image",
              },
            })
          );
        },
      },
      {
        id: "open-in-renamer",
        label: "Abrir carpeta en Renombrador",
        icon: "edit" as const,
        onSelect: () => {
          const norm = target.item.path.replace(/\\/g, "/");
          const lastSlash = norm.lastIndexOf("/");
          const folderDir =
            lastSlash > 0
              ? target.item.path.includes("\\")
                ? norm.slice(0, lastSlash).replace(/\//g, "\\")
                : norm.slice(0, lastSlash)
              : "";
          if (folderDir) {
            window.dispatchEvent(
              new CustomEvent("prisma-open-renamer", {
                detail: {
                  folderPath: folderDir,
                  filterMode: "all",
                },
              })
            );
          }
        },
      },
      {
        id: "show",
        label: "Mostrar en carpeta",
        icon: "folder-open" as const,
        onSelect: () => {
          void invoke("show_in_file_manager", { path: target.item.path }).catch(() => {});
        },
      },
      {
        id: "send-to-mobile",
        label: "Enviar a Super Galería (Móvil)",
        icon: "smartphone" as const,
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent("prisma-send-to-supergallery", {
              detail: { path: target.item.path, title: target.item.title },
            })
          );
        },
      },
      {
        id: "delete",
        label: "Mover a la papelera",
        icon: "trash" as const,
        danger: true,
        onSelect: () => mediaDelete.requestDelete(target.item),
      },
    ];
  };

  return (
    <section className="custom-library">
      <header className="custom-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA MODULAR</span>
          <h1>{definition.label}</h1>
          <p>{definition.description || `Explora y gestiona tus archivos de ${definition.label.toLowerCase()} en formato local-first.`}</p>
        </div>
        <div className="custom-heading-actions">
          <button className="tonal-button" onClick={onOpenFolders}>
            <Icon name="folder" /> Administrar fuentes
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo leer la biblioteca</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {mediaDelete.deleteError ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo eliminar el archivo</strong>
          <span>{mediaDelete.deleteError}</span>
        </div>
      ) : null}

      <div className="custom-controls-bar">
        <div className="custom-summary" aria-live="polite">
          <span>
            <strong>{items.length}</strong> {items.length === 1 ? "archivo" : "archivos"}
          </span>
          <span>
            <strong>{folders.length}</strong> {folders.length === 1 ? "carpeta" : "carpetas"}
          </span>
          <span>
            <i className={folders.some((f) => f.available) ? "is-ready" : ""} /> Escaneo en caliente
          </span>
        </div>

        <div className="custom-controls-right">
          {/* Botón de Recargar compacto de 32px */}
          <button
            className={`media-icon-refresh-btn ${isRefreshing || loading ? "is-refreshing" : ""}`}
            disabled={isRefreshing || loading}
            onClick={() => void handleManualRefresh()}
            title={`Recargar ${definition.label.toLowerCase()} desde el disco`}
            aria-label={`Recargar ${definition.label.toLowerCase()}`}
            type="button"
          >
            <Icon name="refresh" className={isRefreshing || loading ? "spinning-icon" : ""} />
          </button>

          {/* Selector de Ordenación Material 3 Expressive */}
          <div className="custom-sort-container" ref={sortMenuRef}>
            <button
              className={`custom-sort-trigger ${showSortMenu ? "is-open" : ""}`}
              onClick={() => setShowSortMenu(!showSortMenu)}
              title="Cambiar orden de visualización"
              type="button"
            >
              <Icon name={sortField === "random" ? "shuffle" : sortDirection === "asc" ? "sort-asc" : "sort-desc"} />
              <span>
                {sortField === "date" ? "Fecha" : sortField === "name" ? "Nombre" : sortField === "size" ? "Tamaño" : "Aleatorio"}
              </span>
              <Icon className="sort-chevron" name="chevron-down" />
            </button>

            {showSortMenu ? (
              <div className="custom-sort-menu" role="menu">
                <span className="custom-sort-section-title">Ordenar por</span>
                <button
                  className={`custom-sort-item ${sortField === "date" ? "is-selected" : ""}`}
                  onClick={() => setSortField("date")}
                  type="button"
                >
                  <span>Fecha de modificación</span>
                  {sortField === "date" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`custom-sort-item ${sortField === "name" ? "is-selected" : ""}`}
                  onClick={() => setSortField("name")}
                  type="button"
                >
                  <span>Nombre del archivo</span>
                  {sortField === "name" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`custom-sort-item ${sortField === "size" ? "is-selected" : ""}`}
                  onClick={() => setSortField("size")}
                  type="button"
                >
                  <span>Tamaño de archivo</span>
                  {sortField === "size" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`custom-sort-item ${sortField === "random" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("random");
                    setRandomSeed(Date.now());
                  }}
                  type="button"
                >
                  <span>🎲 Aleatorio (Mezclar)</span>
                  {sortField === "random" ? <Icon name="check" /> : null}
                </button>

                {sortField !== "random" ? (
                  <>
                    <div className="custom-sort-divider" />
                    <span className="custom-sort-section-title">Dirección</span>
                    <button
                      className={`custom-sort-item ${sortDirection === "desc" ? "is-selected" : ""}`}
                      onClick={() => setSortDirection("desc")}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más recientes primero" : sortField === "name" ? "Z a A" : "Más pesados primero"}
                      </span>
                      {sortDirection === "desc" ? <Icon name="check" /> : null}
                    </button>
                    <button
                      className={`custom-sort-item ${sortDirection === "asc" ? "is-selected" : ""}`}
                      onClick={() => setSortDirection("asc")}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más antiguos primero" : sortField === "name" ? "A a Z" : "Más ligeros primero"}
                      </span>
                      {sortDirection === "asc" ? <Icon name="check" /> : null}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="custom-view-mode-tabs">
            <button
              className={viewMode === "timeline" ? "is-active" : ""}
              onClick={() => {
                setViewMode("timeline");
                setCurrentFolderPath("");
              }}
              title="Línea de tiempo"
            >
              <Icon name="clock" />
              <span>Tiempo</span>
            </button>
            <button
              className={viewMode === "folders" ? "is-active" : ""}
              onClick={() => {
                setViewMode("folders");
                setCurrentFolderPath("");
              }}
              title="Carpetas"
            >
              <Icon name="folder" />
              <span>Carpetas</span>
            </button>
            <button
              className={viewMode === "tree" ? "is-active" : ""}
              onClick={() => setViewMode("tree")}
              title="Vista en árbol"
            >
              <Icon name="folder-open" />
              <span>Árbol</span>
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="custom-empty-state" aria-busy={loading}>
          <span>
            <Icon name="folder-open" />
          </span>
          <h2>{loading ? `Buscando archivos…` : `Aún no hay archivos de ${definition.label.toLowerCase()}`}</h2>
          <p>Añade una carpeta raíz; Prisma reconocerá los archivos ({definition.extensions.map((e) => `.${e}`).join(", ")}).</p>
          <button className="filled-button" disabled={loading} onClick={() => void chooseFolder()}>
            <Icon name="folder" /> Seleccionar carpeta
          </button>
        </div>
      ) : (
        <>
          {viewMode === "timeline" ? (
            <div className="custom-grid">
              {timelineItems.map((item) => (
                <CustomThumbnailItem
                  item={item}
                  key={item.path}
                  onClick={() => handleOpenFile(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    mediaDelete.openMenu(e, {
                      path: item.path,
                      title: item.name,
                      kind: "image",
                    });
                  }}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "folders" ? (
            currentCollection ? (
              <div className="custom-folder-detail">
                <FolderBreadcrumbHeader
                  currentPath={currentFolderPath}
                  itemCount={currentCollection.items.length}
                  onNavigate={(p) => setCurrentFolderPath(p || "")}
                />
                <div className="custom-grid">
                  {currentCollection.items.map((item) => (
                    <CustomThumbnailItem
                      item={item}
                      key={item.path}
                      onClick={() => handleOpenFile(item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        mediaDelete.openMenu(e, {
                          path: item.path,
                          title: item.name,
                          kind: "image",
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="custom-folder-grid">
                {folderCollections.map((col) => (
                  <div
                    className="custom-folder-card"
                    key={col.folderPath}
                    onClick={() => setCurrentFolderPath(col.folderPath)}
                    onContextMenu={(e) => handleFolderContextMenu(e, col)}
                    title={col.folderName}
                  >
                    <div className="custom-folder-icon">
                      <Icon name="folder" />
                    </div>
                    <div className="custom-folder-info">
                      <strong>{col.folderName}</strong>
                      <span>{col.items.length} {col.items.length === 1 ? "archivo" : "archivos"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {viewMode === "tree" ? (
            <div className="custom-tree-container">
              <MediaTreeView
                items={displayedItems.map((it) => ({
                  path: it.path,
                  title: it.name,
                  relativeFolder: it.relativeFolder,
                  sizeBytes: it.sizeBytes,
                }))}
                mediaType="image"
                onPlayItem={(item) => {
                  const found = displayedItems.find((i) => i.path === item.path);
                  if (found) handleOpenFile(found);
                }}
                onOpenItemMenu={(event, item) => {
                  const found = displayedItems.find((i) => i.path === item.path);
                  if (found) {
                    mediaDelete.openMenu(event, {
                      path: found.path,
                      title: found.name,
                      kind: "image",
                    });
                  }
                }}
                onOpenFolderMenu={(event, folder) => {
                  const folderFiles = folder.allRecursiveItems
                    .map((it) => displayedItems.find((i) => i.path === it.path))
                    .filter((it): it is CustomLibraryItem => it !== undefined);
                  handleFolderContextMenu(event, {
                    folderName: folder.displayName,
                    folderPath: folder.id,
                    items: folderFiles,
                  });
                }}
              />
            </div>
          ) : null}
        </>
      )}

      {mediaDelete.menu ? (
        <ContextMenu
          items={buildMenuItems()}
          onClose={mediaDelete.closeMenu}
          x={mediaDelete.menu.x}
          y={mediaDelete.menu.y}
        />
      ) : null}

      {folderMenu ? (
        <ContextMenu
          items={buildFolderMenuItems()}
          onClose={() => setFolderMenu(null)}
          x={folderMenu.x}
          y={folderMenu.y}
        />
      ) : null}

      {mediaDelete.pendingDelete ? (
        <ConfirmDialog
          confirmLabel="Mover a la papelera"
          danger
          message={`¿Deseas mover "${mediaDelete.pendingDelete.title}" a la papelera de reciclaje?`}
          onCancel={mediaDelete.cancelDelete}
          onConfirm={mediaDelete.confirmDelete}
          title="Eliminar archivo"
        />
      ) : null}

      {selectedDocItem ? (
        <DocumentViewer
          externalAppCommand={definition.externalAppCommand}
          item={selectedDocItem}
          itemsList={displayedItems}
          onClose={() => setSelectedDocItem(null)}
          onSelectDoc={(nextItem) => setSelectedDocItem(nextItem)}
        />
      ) : null}
    </section>
  );
}

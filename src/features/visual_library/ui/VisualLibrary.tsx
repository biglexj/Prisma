import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import {
  cleanPath,
  resolveTreeLevel,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import { useMediaRename } from "../../../shared/useMediaRename";
import { RenameMediaDialog } from "../../../shared/ui/RenameMediaDialog";
import type { VisualFolderSource, VisualLibraryItem, VisualMediaKind } from "../model/types";
import { VisualThumbnail } from "./VisualThumbnail";
import { VideoThumbnail } from "./VideoThumbnail";
import { ImageViewer } from "./ImageViewer";
import { ImageEditor } from "./editor/ImageEditor";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./visual-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "timeline" | "folders" | "tree";
export type VisualSortField = "date" | "name" | "size" | "random";
export type VisualSortDirection = "desc" | "asc";

// Memoria de sesión para recordar pestaña, carpeta abierta y criterio de ordenación en imágenes y vídeos
const sessionVisualState: Record<
  VisualMediaKind,
  {
    viewMode: ViewMode;
    folderPath: string;
    sortField: VisualSortField;
    sortDirection: VisualSortDirection;
  }
> = {
  image: { viewMode: "timeline", folderPath: "", sortField: "date", sortDirection: "desc" },
  video: { viewMode: "timeline", folderPath: "", sortField: "date", sortDirection: "desc" },
};

interface TimelineSection {
  title: string;
  items: VisualLibraryItem[];
}

interface VisualLibraryProps {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  items: VisualLibraryItem[];
  loading: boolean;
  error: string | null;
  initialSelectedImagePath?: string | null;
  onClearInitialSelectedImage?: () => void;
  onAdd: (path: string) => Promise<void>;
  onOpenVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onOpenFolders: () => void;
  confirmDeletion: boolean;
  onRefresh: () => void | Promise<void>;
}

export function VisualLibrary({
  kind,
  folders,
  items,
  loading,
  error,
  initialSelectedImagePath,
  onClearInitialSelectedImage,
  onAdd,
  onOpenVideo,
  onOpenFolders,
  confirmDeletion,
  onRefresh,
}: VisualLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionVisualState[kind].viewMode);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(() => sessionVisualState[kind].folderPath);
  const [sortField, setSortField] = useState<VisualSortField>(() => sessionVisualState[kind].sortField);
  const [sortDirection, setSortDirection] = useState<VisualSortDirection>(() => sessionVisualState[kind].sortDirection);
  const [randomSeed, setRandomSeed] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const [editingImageItem, setEditingImageItem] = useState<VisualLibraryItem | null>(null);
  const [activeImageSessionList, setActiveImageSessionList] = useState<VisualLibraryItem[] | null>(null);
  const favorites = useFavorites();
  const mediaRename = useMediaRename({ onRefresh });
  const mediaDelete = useMediaDelete({
    confirmDeletion,
    onRefresh,
    onDeleted: (item) => {
      if (selectedImage && item.path === selectedImage.path) {
        setSelectedImage(null);
        setActiveImageSessionList(null);
      }
      if (editingImageItem && item.path === editingImageItem.path) {
        setEditingImageItem(null);
      }
    },
  });

  const isImage = kind === "image";
  const label = isImage ? "Imágenes" : "Vídeos";

  // Cerrar menú de ordenación al hacer click fuera
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
      title: `Añadir carpeta de ${label.toLowerCase()} a Prisma`,
    });
    if (typeof selection === "string") await onAdd(selection);
  };

  const nonExcludedItems = items.filter((it) => !it.isExcluded);

  // Hash determinista para ordenación aleatoria pero estable
  const hashString = (str: string, seed: number) => {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  };

  // Función de ordenación pura aplicable a cualquier colección de ítems
  const sortItemList = (itemList: VisualLibraryItem[]): VisualLibraryItem[] => {
    return [...itemList].sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = (b.modifiedAtMillis || 0) - (a.modifiedAtMillis || 0);
      } else if (sortField === "name") {
        comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "size") {
        comparison = (b.sizeBytes || 0) - (a.sizeBytes || 0);
      } else if (sortField === "random") {
        const hashA = hashString(a.path, randomSeed);
        const hashB = hashString(b.path, randomSeed);
        comparison = hashA - hashB;
      }
      return sortDirection === "asc" ? -comparison : comparison;
    });
  };

  // En la línea de tiempo: los bloques de tiempo se agrupan, y dentro de cada día se ordenan los elementos según sortField/sortDirection
  const visibleItems = nonExcludedItems.slice(0, VISIBLE_ITEM_LIMIT);
  const timelineSections = groupByTimeline(visibleItems, sortItemList);

  // Árbol jerárquico y colecciones
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: isImage ? "Todas las imágenes" : "Todos los vídeos",
    mediaType: isImage ? "image" : "video",
  });

  // Ítems directos ordenados para la vista de carpetas
  const sortedDirectItems = sortItemList(treeLevel.directItems);

  const isInsideFolder = currentFolderPath !== "";

  // Active list for current view
  const currentActiveList = activeImageSessionList ?? (
    isInsideFolder
      ? (sortedDirectItems.length > 0 ? sortedDirectItems : sortItemList(treeLevel.allRecursiveItems))
      : (viewMode === "timeline" ? nonExcludedItems : items)
  );

  const handleSelectImage = (item: VisualLibraryItem, queueList?: VisualLibraryItem[]) => {
    setSelectedImage(item);
    setActiveImageSessionList(queueList ?? null);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    setActiveImageSessionList(null);
  };

  const handlePlayAllVideos = () => {
    if (items.length === 0) return;
    onOpenVideo(items[0].path, items);
  };

  const handlePlayFolderVideos = (folderItems: VisualLibraryItem[]) => {
    if (folderItems.length === 0) return;
    onOpenVideo(folderItems[0].path, folderItems);
  };

  const handleCardContextMenu = (event: React.MouseEvent, item: VisualLibraryItem) => {
    mediaDelete.openMenu(event, {
      path: item.path,
      title: item.title,
      kind: isImage ? "image" : "video",
    });
  };

  const handleCardDeleteRequest = (item: VisualLibraryItem) => {
    mediaDelete.requestDelete({
      path: item.path,
      title: item.title,
      kind: isImage ? "image" : "video",
    });
  };

  const buildMenuItems = () => {
    const target = mediaDelete.menu;
    if (!target) return [];
    const isFav = favorites.isFavorite(target.item.path);
    const menuItems = [];

    if (isImage) {
      menuItems.push({
        id: "edit",
        label: "Editar imagen",
        icon: "crop" as const,
        onSelect: () => {
          const found = items.find((it) => it.path === target.item.path) || {
            path: target.item.path,
            title: target.item.title,
            sourcePath: "",
            relativeFolder: "",
            kind: "image" as const,
            modifiedAtMillis: Date.now(),
            sizeBytes: 0,
          };
          setEditingImageItem(found);
        },
      });
    }

    menuItems.push(
      {
        id: "rename",
        label: "Renombrar",
        icon: "edit" as const,
        onSelect: () =>
          mediaRename.requestRename({
            path: target.item.path,
            title: target.item.title,
            kind: isImage ? "image" : "video",
          }),
      },
      {
        id: "favorite",
        label: isFav ? "Quitar de favoritos" : "Añadir a favoritos",
        icon: "heart" as const,
        onSelect: () => favorites.toggleFavorite(target.item.path, kind),
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
        id: "delete",
        label: "Mover a la papelera",
        icon: "trash" as const,
        danger: true,
        onSelect: () => mediaDelete.requestDelete(target.item),
      }
    );

    return menuItems;
  };

  // Abrir imagen seleccionada externamente (por ejemplo, desde Inicio o sistema)
  useEffect(() => {
    if (initialSelectedImagePath) {
      const found = items.find((it) => it.path === initialSelectedImagePath) || {
        path: initialSelectedImagePath,
        title: initialSelectedImagePath.replace(/\\/g, "/").split("/").pop() || "Imagen",
        sourcePath: "",
        relativeFolder: "",
        kind: "image" as const,
        modifiedAtMillis: Date.now(),
        sizeBytes: 0,
      };
      handleSelectImage(found);
      onClearInitialSelectedImage?.();
    }
  }, [initialSelectedImagePath, items]);

  // Preservar y restaurar la posición exacta del scroll al navegar o volver
  useScrollRestoration(`view:${kind}:${viewMode}:${currentFolderPath}`, !loading);

  const handleSwitchMode = (mode: ViewMode) => {
    setViewMode(mode);
    sessionVisualState[kind].viewMode = mode;
  };

  const handleNavigateFolder = (path: string) => {
    setCurrentFolderPath(path);
    sessionVisualState[kind].folderPath = path;
  };

  return (
    <section className={`visual-library visual-library-${kind}`}>
      <header className="visual-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA VISUAL</span>
          <h1>{label}</h1>
          <p>
            {isImage
              ? "Explora tus fotografías e ilustraciones organizadas en Bento Grid adaptativo, árbol jerárquico de carpetas y visor cinematográfico con zoom."
              : "Organiza y reproduce tus vídeos locales con árbol de carpetas, favoritos, gestión de colas y reproductor de cine."}
          </p>
        </div>
        <div className="visual-heading-actions">
          {!isImage && items.length > 0 ? (
            <button className="tonal-button is-primary" onClick={handlePlayAllVideos} title="Reproducir todos los vídeos">
              <Icon name="play" /> Reproducir todo
            </button>
          ) : null}
          <button className="tonal-button" onClick={onOpenFolders}>
            <Icon name="folder" /> Administrar fuentes
          </button>
          <button className="filled-button" onClick={() => void chooseFolder()}>
            <Icon name="plus" /> Añadir carpeta
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo leer la biblioteca de {label.toLowerCase()}</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {mediaDelete.deleteError ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo eliminar el archivo</strong>
          <span>{mediaDelete.deleteError}</span>
        </div>
      ) : null}

      <div className="visual-controls-bar">
        <div className="visual-summary" aria-live="polite">
          <span>
            <strong>{items.length}</strong> {label.toLowerCase()}
          </span>
          <span>
            <strong>{folders.length}</strong> {folders.length === 1 ? "carpeta" : "carpetas"}
          </span>
          <span>
            <i className={folders.some((folder) => folder.available) ? "is-ready" : ""} /> Escaneo bajo demanda
          </span>
        </div>

        <div className="visual-controls-right">
          {/* Selector de Ordenación Material 3 Expressive */}
          <div className="visual-sort-container" ref={sortMenuRef}>
            <button
              className={`visual-sort-trigger ${showSortMenu ? "is-open" : ""}`}
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
              <div className="visual-sort-menu" role="menu">
                <span className="visual-sort-section-title">Ordenar por</span>
                <button
                  className={`visual-sort-item ${sortField === "date" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("date");
                    sessionVisualState[kind].sortField = "date";
                  }}
                  type="button"
                >
                  <span>Fecha de modificación</span>
                  {sortField === "date" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`visual-sort-item ${sortField === "name" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("name");
                    sessionVisualState[kind].sortField = "name";
                  }}
                  type="button"
                >
                  <span>Nombre del archivo</span>
                  {sortField === "name" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`visual-sort-item ${sortField === "size" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("size");
                    sessionVisualState[kind].sortField = "size";
                  }}
                  type="button"
                >
                  <span>Tamaño de archivo</span>
                  {sortField === "size" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`visual-sort-item ${sortField === "random" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("random");
                    setRandomSeed(Date.now());
                    sessionVisualState[kind].sortField = "random";
                  }}
                  type="button"
                >
                  <span>🎲 Aleatorio (Mezclar)</span>
                  {sortField === "random" ? <Icon name="check" /> : null}
                </button>

                {sortField !== "random" ? (
                  <>
                    <div className="visual-sort-divider" />
                    <span className="visual-sort-section-title">Dirección</span>
                    <button
                      className={`visual-sort-item ${sortDirection === "desc" ? "is-selected" : ""}`}
                      onClick={() => {
                        setSortDirection("desc");
                        sessionVisualState[kind].sortDirection = "desc";
                      }}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más recientes primero" : sortField === "name" ? "Z a A" : "Más pesados primero"}
                      </span>
                      {sortDirection === "desc" ? <Icon name="check" /> : null}
                    </button>
                    <button
                      className={`visual-sort-item ${sortDirection === "asc" ? "is-selected" : ""}`}
                      onClick={() => {
                        setSortDirection("asc");
                        sessionVisualState[kind].sortDirection = "asc";
                      }}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más antiguos primero" : sortField === "name" ? "A a Z" : "Más ligeros primero"}
                      </span>
                      {sortDirection === "asc" ? <Icon name="check" /> : null}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="visual-sort-divider" />
                    <button
                      className="visual-sort-item"
                      onClick={() => setRandomSeed(Date.now())}
                      style={{ color: "var(--primary)" }}
                      type="button"
                    >
                      <span>⚡ Volver a mezclar</span>
                      <Icon name="refresh" />
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="visual-view-mode-tabs">
            <button
              className={viewMode === "timeline" ? "is-active" : ""}
              onClick={() => handleSwitchMode("timeline")}
              title="Línea de tiempo"
            >
              <Icon name="clock" />
              <span>Tiempo</span>
            </button>
            <button
              className={viewMode === "folders" ? "is-active" : ""}
              onClick={() => handleSwitchMode("folders")}
              title="Carpetas"
            >
              <Icon name="folder" />
              <span>Carpetas</span>
            </button>
            <button
              className={viewMode === "tree" ? "is-active" : ""}
              onClick={() => handleSwitchMode("tree")}
              title="Vista en árbol"
            >
              <Icon name="folder-open" />
              <span>Árbol</span>
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="visual-empty-state" aria-busy={loading}>
          <span>
            <Icon name={isImage ? "image" : "video"} />
          </span>
          <h2>{loading ? `Buscando ${label.toLowerCase()}…` : `Aún no hay ${label.toLowerCase()}`}</h2>
          <p>Añade una carpeta raíz; Prisma reconocerá también el contenido de sus subcarpetas.</p>
          <button className="filled-button" disabled={loading} onClick={() => void chooseFolder()}>
            <Icon name="folder" /> Seleccionar carpeta
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        /* ── 1. Cuadrícula Bento (Imágenes) / Cuadrícula 16:9 (Vídeos) ── */
        <div className="visual-timeline-container" aria-busy={loading}>
          {timelineSections.map((section) => (
            <div className="visual-section" key={section.title}>
              <header className="visual-section-header">
                <h3>{section.title}</h3>
                <span className="visual-section-count">
                  {section.items.length} {section.items.length === 1 ? "elemento" : "elementos"}
                </span>
              </header>
              <div className={`visual-grid ${isImage ? "bento-grid-layout" : "video-grid-layout"}`}>
                {section.items.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item, items)
                        : onOpenVideo(item.path, items)
                    }
                    onContextMenu={(event) => handleCardContextMenu(event, item)}
                    onDeleteRequest={() => handleCardDeleteRequest(item)}
                    onToggleFavorite={() => favorites.toggleFavorite(item.path, kind)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "folders" ? (
        /* ── 2. Vista de Colecciones de Carpetas como Álbumes ── */
        <div className="visual-folder-tree-view" aria-busy={loading}>
          {isInsideFolder ? (
            <FolderBreadcrumbHeader
              currentPath={currentFolderPath}
              itemCount={treeLevel.allRecursiveItems.length}
              onNavigate={(path) => handleNavigateFolder(path ?? "")}
              onPlayFolder={!isImage ? () => handlePlayFolderVideos(treeLevel.allRecursiveItems) : undefined}
            />
          ) : null}

          {/* Subcarpetas / Colecciones en este nivel */}
          {treeLevel.subfolders.length > 0 ? (
            <div className="visual-folder-collections-section">
              <div className="visual-folder-collections">
                {treeLevel.subfolders.map((folder) => (
                  <VisualFolderCard
                    folder={folder}
                    isImage={isImage}
                    key={folder.id}
                    onOpen={() => handleNavigateFolder(folder.id)}
                    onPlayVideo={!isImage ? () => handlePlayFolderVideos(folder.allRecursiveItems) : undefined}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Archivos directos o lista de carpeta virtual */}
          {sortedDirectItems.length > 0 ? (
            <div className="visual-direct-items-section">
              <div className={`visual-grid ${isImage ? "bento-grid-layout" : "video-grid-layout"}`}>
                {sortedDirectItems.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item, sortedDirectItems)
                        : onOpenVideo(item.path, sortedDirectItems)
                    }
                    onContextMenu={(event) => handleCardContextMenu(event, item)}
                    onDeleteRequest={() => handleCardDeleteRequest(item)}
                    onToggleFavorite={() => favorites.toggleFavorite(item.path, kind)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* ── 3. Vista en Árbol Expandible (Lienzo Style) ── */
        <MediaTreeView
          items={items}
          mediaType={isImage ? "image" : "video"}
          onPlayFolder={!isImage ? (folderItems) => handlePlayFolderVideos(folderItems) : undefined}
          onPlayItem={(item, list) => {
            if (isImage) {
              handleSelectImage(item, list);
            } else {
              onOpenVideo(item.path, list);
            }
          }}
          onOpenItemMenu={handleCardContextMenu}
          onDeleteRequest={handleCardDeleteRequest}
        />
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "timeline" ? (
        <p className="visual-limit-note">
          Se muestran los {VISIBLE_ITEM_LIMIT} elementos más recientes para mantener la interfaz ligera.
        </p>
      ) : null}

      {/* Visor Cinematográfico de Imágenes con Zoom y Pan */}
      {selectedImage ? (
        <ImageViewer
          confirmDeletion={confirmDeletion}
          item={selectedImage}
          itemsList={currentActiveList}
          onClose={closeImageViewer}
          onRefresh={onRefresh}
          onSelectImage={(item) => handleSelectImage(item, currentActiveList)}
        />
      ) : null}

      {mediaDelete.menu ? (
        <ContextMenu
          items={buildMenuItems()}
          onClose={mediaDelete.closeMenu}
          x={mediaDelete.menu.x}
          y={mediaDelete.menu.y}
        />
      ) : null}

      {mediaDelete.pendingDelete ? (
        <ConfirmDialog
          cancelLabel="Cancelar"
          confirmLabel="Mover a la papelera"
          danger
          message={
            <span>
              Se enviará <strong>{mediaDelete.pendingDelete.title}</strong> a la papelera de
              reciclaje del sistema.
            </span>
          }
          onCancel={mediaDelete.cancelDelete}
          onConfirm={mediaDelete.confirmDelete}
          title={`Mover ${isImage ? "imagen" : "vídeo"} a la papelera`}
        />
      ) : null}

      {editingImageItem && (
        <ImageEditor
          item={editingImageItem}
          onClose={() => setEditingImageItem(null)}
          onSaveSuccess={async (savedPath, isOverwrite) => {
            await onRefresh();
            setEditingImageItem(null);
            if (!isOverwrite) {
              const fileName = savedPath.replace(/\\/g, "/").split("/").pop() || "imagen.png";
              setSelectedImage({
                ...editingImageItem,
                path: savedPath,
                title: fileName,
              });
            }
          }}
        />
      )}

      {mediaRename.pendingRename && (
        <RenameMediaDialog
          currentPath={mediaRename.pendingRename.path}
          currentTitle={mediaRename.pendingRename.title}
          onConfirm={mediaRename.confirmRename}
          onCancel={mediaRename.cancelRename}
        />
      )}
    </section>
  );
}

interface VisualCardProps {
  item: VisualLibraryItem;
  index: number;
  isImage: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDeleteRequest?: () => void;
  onToggleFavorite?: () => void;
}

function VisualCard({
  item,
  index,
  isImage,
  isFavorite,
  onClick,
  onContextMenu,
  onDeleteRequest,
  onToggleFavorite,
}: VisualCardProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Bento adaptativo determinista
  let layoutClass = "";
  if (isImage) {
    if (dimensions) {
      const ratio = dimensions.width / dimensions.height;
      if (ratio > 1.45) {
        layoutClass = "bento-card-horizontal";
      } else if (ratio < 0.72) {
        layoutClass = "bento-card-vertical";
      } else {
        layoutClass = "bento-card-square";
      }
    } else {
      layoutClass = "bento-card-square";
    }
  } else {
    layoutClass = "video-card-16-9";
  }

  return (
    <div className={`visual-media-card-wrapper ${layoutClass}`}>
      <button
        className="visual-media-card"
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={(event) => {
          if (
            onDeleteRequest &&
            (event.key === "Delete" ||
              event.key === "Del" ||
              event.key === "Supr" ||
              event.code === "Delete")
          ) {
            event.preventDefault();
            event.stopPropagation();
            onDeleteRequest();
          }
        }}
        title={cleanPath(item.path)}
      >
        <span className="visual-media-frame">
          {isImage ? (
            <VisualThumbnail
              alt={item.title}
              className="visual-thumbnail"
              onLoadDimensions={(w, h) => setDimensions({ width: w, height: h })}
              path={item.path}
            />
          ) : (
            <VideoThumbnail
              className="visual-thumbnail"
              path={item.path}
              title={item.title}
            />
          )}
          {!isImage ? (
            <i className="visual-play">
              <Icon name="play" />
            </i>
          ) : null}
        </span>
        <span className="visual-card-caption">
          <strong>{item.title}</strong>
          <small>
            {cleanPath(item.relativeFolder)} · {formatBytes(item.sizeBytes)}
          </small>
        </span>
      </button>

      {onToggleFavorite ? (
        <button
          className={`visual-card-fav-btn ${isFavorite ? "is-favorite" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <Icon name="heart" />
        </button>
      ) : null}
    </div>
  );
}

interface VisualFolderCardProps {
  folder: HierarchicalFolder<VisualLibraryItem>;
  isImage: boolean;
  onOpen: () => void;
  onPlayVideo?: () => void;
}

function VisualFolderCard({
  folder,
  isImage,
  onOpen,
  onPlayVideo,
}: VisualFolderCardProps) {
  const isFavorites = folder.isVirtual && folder.virtualType === "favorites";
  const isAll = folder.isVirtual && folder.virtualType === "all";
  const firstItem = folder.allRecursiveItems[0];

  return (
    <div
      className={`folder-collection-card ${isFavorites ? "is-virtual-favorites" : ""} ${isAll ? "is-virtual-all" : ""}`}
      onClick={onOpen}
      title={folder.displayName}
    >
      <div className="folder-collection-cover-frame">
        {isFavorites ? (
          <div className="folder-virtual-card-art is-favorites">
            <Icon name="star" />
          </div>
        ) : isAll ? (
          <div className="folder-virtual-card-art is-all">
            <Icon name={isImage ? "image" : "video"} />
          </div>
        ) : firstItem ? (
          isImage ? (
            <VisualThumbnail
              alt={folder.displayName}
              className="folder-cover-thumbnail"
              path={firstItem.path}
            />
          ) : (
            <VideoThumbnail
              className="folder-cover-thumbnail"
              path={firstItem.path}
              title={folder.displayName}
            />
          )
        ) : (
          <span className="folder-collection-empty">
            <Icon name={isImage ? "image" : "video"} />
          </span>
        )}

        <div className="folder-collection-hover-overlay">
          {onPlayVideo && folder.allRecursiveItems.length > 0 ? (
            <button
              className="folder-play-overlay-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlayVideo();
              }}
              title="Reproducir vídeos del álbum"
            >
              <Icon name="play" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="folder-collection-info">
        <strong className="folder-collection-name">
          {isFavorites ? "⭐ Favoritos" : folder.displayName}
        </strong>
        <span className="folder-collection-count">
          {folder.allRecursiveItems.length}{" "}
          {folder.allRecursiveItems.length === 1 ? "archivo" : "archivos"}
        </span>
      </div>
    </div>
  );
}

function groupByTimeline(
  items: VisualLibraryItem[],
  sorter?: (items: VisualLibraryItem[]) => VisualLibraryItem[]
): TimelineSection[] {
  const groupsMap = new Map<string, VisualLibraryItem[]>();

  const now = new Date();
  const todayTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayTimestamp = todayTimestamp - 86400000;

  for (const item of items) {
    const itemDate = new Date(item.modifiedAtMillis);
    const itemDayTimestamp = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

    let title: string;
    if (itemDayTimestamp === todayTimestamp) {
      title = "Hoy";
    } else if (itemDayTimestamp === yesterdayTimestamp) {
      title = "Ayer";
    } else {
      title = itemDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const existing = groupsMap.get(title);
    if (existing) {
      existing.push(item);
    } else {
      groupsMap.set(title, [item]);
    }
  }

  return Array.from(groupsMap.entries()).map(([title, groupItems]) => ({
    title,
    // Aplica el orden (ej. por nombre A-Z o fecha o tamaño) a los ítems dentro de cada grupo temporal
    items: sorter ? sorter(groupItems) : groupItems,
  }));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

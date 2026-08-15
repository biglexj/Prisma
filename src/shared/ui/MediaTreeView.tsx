import { useState, useMemo } from "react";
import { Icon } from "./Icon";
import { useFavorites } from "../useFavorites";
import { MusicArtwork } from "../../features/music_library/ui/MusicArtwork";
import { VisualThumbnail } from "../../features/visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../features/visual_library/ui/VideoThumbnail";
import "./media-tree.css";

export interface MediaTreeItem {
  path: string;
  title: string;
  relativeFolder?: string;
  sizeBytes?: number;
}

interface TreeNode<T> {
  path: string;
  name: string;
  level: number;
  isDirectory: boolean;
  isVirtual?: boolean;
  virtualType?: "favorites" | "all";
  item?: T;
  directItems: T[];
  allRecursiveItems: T[];
  children: TreeNode<T>[];
}

interface MediaTreeViewProps<T extends MediaTreeItem> {
  items: T[];
  mediaType: "music" | "image" | "video";
  onPlayItem: (item: T, list: T[]) => void;
  onPlayFolder?: (items: T[], folderName: string) => void;
  onAddToQueue?: (item: T) => void;
  onAddFolderToQueue?: (items: T[]) => void;
}

// Memoria de sesión para preservar las carpetas expandidas por tipo de medio
const sessionTreeExpandedPaths = new Map<string, Set<string>>([
  ["music", new Set<string>()],
  ["image", new Set<string>()],
  ["video", new Set<string>()],
]);

const TREE_CHILDREN_DISPLAY_LIMIT = 250;

export function MediaTreeView<T extends MediaTreeItem>({
  items,
  mediaType,
  onPlayItem,
  onPlayFolder,
  onAddToQueue,
  onAddFolderToQueue,
}: MediaTreeViewProps<T>) {
  const favorites = useFavorites();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    return new Set(sessionTreeExpandedPaths.get(mediaType) || []);
  });

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      sessionTreeExpandedPaths.set(mediaType, next);
      return next;
    });
  };

  // Construcción de la estructura de árbol jerárquico
  const rootNodes = useMemo(() => {
    const favItems = items.filter((it) => favorites.isFavorite(it.path));

    const favNode: TreeNode<T> = {
      path: "virtual_favorites",
      name: "⭐ Favoritos",
      level: 0,
      isDirectory: true,
      isVirtual: true,
      virtualType: "favorites",
      directItems: favItems,
      allRecursiveItems: favItems,
      children: favItems.map((it) => ({
        path: `fav_${it.path}`,
        name: it.title,
        level: 1,
        isDirectory: false,
        item: it,
        directItems: [],
        allRecursiveItems: [],
        children: [],
      })),
    };

    const allLabel =
      mediaType === "music"
        ? "Todas las canciones"
        : mediaType === "image"
        ? "Todas las imágenes"
        : "Todos los vídeos";

    const allNode: TreeNode<T> = {
      path: "virtual_all",
      name: allLabel,
      level: 0,
      isDirectory: true,
      isVirtual: true,
      virtualType: "all",
      directItems: items,
      allRecursiveItems: items,
      children: items.map((it) => ({
        path: `all_${it.path}`,
        name: it.title,
        level: 1,
        isDirectory: false,
        item: it,
        directItems: [],
        allRecursiveItems: [],
        children: [],
      })),
    };

    // Constructor de jerarquía de directorios físicos
    interface DirBucket {
      name: string;
      fullPath: string;
      subdirs: Map<string, DirBucket>;
      directFiles: T[];
    }

    const rootBucket: DirBucket = {
      name: "Almacenamiento Local",
      fullPath: "storage_root",
      subdirs: new Map(),
      directFiles: [],
    };

    for (const item of items) {
      const rel = (item.relativeFolder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      if (!rel || rel === "Carpeta principal" || rel === ".") {
        rootBucket.directFiles.push(item);
      } else {
        const segments = rel.split("/").filter(Boolean);
        let curr = rootBucket;
        let currPath = "";
        for (const seg of segments) {
          currPath = currPath ? `${currPath}/${seg}` : seg;
          let sub = curr.subdirs.get(seg);
          if (!sub) {
            sub = {
              name: seg,
              fullPath: currPath,
              subdirs: new Map(),
              directFiles: [],
            };
            curr.subdirs.set(seg, sub);
          }
          curr = sub;
        }
        curr.directFiles.push(item);
      }
    }

    function bucketToTreeNode(bucket: DirBucket, level: number): TreeNode<T> {
      const children: TreeNode<T>[] = [];

      const sortedSubdirs = Array.from(bucket.subdirs.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
      );

      const allRecursive: T[] = [...bucket.directFiles];

      for (const sub of sortedSubdirs) {
        const subNode = bucketToTreeNode(sub, level + 1);
        children.push(subNode);
        allRecursive.push(...subNode.allRecursiveItems);
      }

      for (const file of bucket.directFiles) {
        children.push({
          path: file.path,
          name: file.title,
          level: level + 1,
          isDirectory: false,
          item: file,
          directItems: [],
          allRecursiveItems: [],
          children: [],
        });
      }

      return {
        path: bucket.fullPath,
        name: bucket.name,
        level,
        isDirectory: true,
        directItems: bucket.directFiles,
        allRecursiveItems: allRecursive,
        children,
      };
    }

    const storageNode = bucketToTreeNode(rootBucket, 0);

    return [favNode, allNode, storageNode];
  }, [items, favorites.favorites, mediaType]);

  const renderNode = (node: TreeNode<T>): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const indentPx = node.level * 20;

    if (node.isDirectory) {
      const isFav = node.isVirtual && node.virtualType === "favorites";
      const isAll = node.isVirtual && node.virtualType === "all";

      const visibleChildren = isExpanded
        ? node.children.slice(0, TREE_CHILDREN_DISPLAY_LIMIT)
        : [];
      const hasMoreChildren = node.children.length > TREE_CHILDREN_DISPLAY_LIMIT;

      return (
        <div className="media-tree-node-group" key={node.path}>
          <div
            className={`media-tree-row is-directory ${isFav ? "is-fav-virtual" : ""} ${isAll ? "is-all-virtual" : ""}`}
            onClick={() => toggleExpand(node.path)}
            style={{ paddingLeft: `${indentPx + 12}px` }}
          >
            <span className="media-tree-chevron">
              <Icon name={isExpanded ? "chevron-down" : "chevron-right"} />
            </span>

            <span className="media-tree-icon">
              {isFav ? (
                <Icon name="star" />
              ) : isAll ? (
                <Icon name="disc" />
              ) : (
                <Icon name={isExpanded ? "folder-open" : "folder"} />
              )}
            </span>

            <strong className="media-tree-name">{node.name}</strong>

            <span className="media-tree-badge">
              {node.allRecursiveItems.length}
            </span>

            {node.allRecursiveItems.length > 0 && onPlayFolder ? (
              <button
                className="media-tree-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayFolder(node.allRecursiveItems, node.name);
                }}
                title="Reproducir carpeta"
              >
                <Icon name="play" />
              </button>
            ) : null}

            {node.allRecursiveItems.length > 0 && onAddFolderToQueue ? (
              <button
                className="media-tree-queue-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddFolderToQueue(node.allRecursiveItems);
                }}
                title="+ Cola"
              >
                <Icon name="queue" />
              </button>
            ) : null}
          </div>

          {isExpanded && node.children.length > 0 ? (
            <div className="media-tree-children">
              {visibleChildren.map(renderNode)}
              {hasMoreChildren ? (
                <div
                  className="media-tree-limit-hint"
                  style={{ paddingLeft: `${indentPx + 36}px` }}
                >
                  Mostrando los primeros {TREE_CHILDREN_DISPLAY_LIMIT} de {node.children.length} elementos para máxima fluidez.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    // Leaf file node
    const file = node.item!;
    const isFavorite = favorites.isFavorite(file.path);

    return (
      <div
        className="media-tree-row is-file"
        key={node.path}
        onClick={() => onPlayItem(file, items)}
        style={{ paddingLeft: `${indentPx + 24}px` }}
      >
        <span className="media-tree-file-thumb">
          {mediaType === "music" ? (
            <MusicArtwork alt={file.title} className="media-tree-thumb-media" path={file.path} />
          ) : mediaType === "image" ? (
            <VisualThumbnail alt={file.title} className="media-tree-thumb-media" path={file.path} />
          ) : (
            <VideoThumbnail className="media-tree-thumb-media" path={file.path} title={file.title} />
          )}
        </span>

        <div className="media-tree-file-info">
          <strong className="media-tree-file-title" title={file.title}>
            {file.title}
          </strong>
          <span className="media-tree-file-sub" title={file.relativeFolder}>
            {file.relativeFolder || "Carpeta principal"}
            {file.sizeBytes ? ` · ${formatBytes(file.sizeBytes)}` : ""}
          </span>
        </div>

        <div className="media-tree-file-actions">
          <button
            className={`media-tree-fav-btn ${isFavorite ? "is-favorite" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              favorites.toggleFavorite(file.path);
            }}
            title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
            <Icon name="heart" />
          </button>

          {onAddToQueue ? (
            <button
              className="media-tree-queue-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue(file);
              }}
              title="Añadir a la cola"
            >
              <Icon name="queue" />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="media-tree-container">
      {rootNodes.map(renderNode)}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

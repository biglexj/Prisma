import { useMemo } from "react";
import { Icon } from "./Icon";
import "./folder-breadcrumb.css";

interface FolderBreadcrumbHeaderProps {
  currentPath: string | null;
  rootPath?: string | null;
  onNavigate: (path: string | null) => void;
  onPlayFolder?: (path: string) => void;
  onAddFolderToQueue?: (path: string) => void;
  itemCount?: number;
  className?: string;
}

interface PathSegment {
  name: string;
  path: string;
}

export function FolderBreadcrumbHeader({
  currentPath,
  rootPath,
  onNavigate,
  onPlayFolder,
  onAddFolderToQueue,
  itemCount,
  className = "",
}: FolderBreadcrumbHeaderProps) {
  const segments = useMemo(() => {
    if (!currentPath) return [];

    const normalized = currentPath.replace(/\\/g, "/").replace(/\/$/, "");
    const parts = normalized.split("/").filter(Boolean);

    // Build cumulative path segments
    const isWindowsDrive = parts.length > 0 && /^[a-zA-Z]:$/.test(parts[0]);
    const list: PathSegment[] = [];

    let accum = isWindowsDrive ? parts[0] : "";
    const startIdx = isWindowsDrive ? 1 : 0;

    if (isWindowsDrive) {
      list.push({
        name: parts[0],
        path: parts[0] + "\\",
      });
    }

    for (let i = startIdx; i < parts.length; i++) {
      const part = parts[i];
      accum = accum ? `${accum}/${part}` : part;
      list.push({
        name: part,
        path: accum.replace(/\//g, "\\"),
      });
    }

    return list;
  }, [currentPath]);

  const canGoUp = segments.length > 1;

  const handleGoUp = () => {
    if (segments.length > 1) {
      const parentPath = segments[segments.length - 2].path;
      onNavigate(parentPath);
    } else if (segments.length === 1 && !rootPath) {
      onNavigate(null);
    }
  };

  return (
    <nav className={`folder-breadcrumb-bar ${className}`} aria-label="Navegación de carpetas">
      <div className="breadcrumb-nav-group">
        <button
          className="breadcrumb-root-btn"
          onClick={() => onNavigate(null)}
          title="Todas las carpetas"
          aria-label="Ir a todas las carpetas"
        >
          <Icon name="folder" />
          <span>Biblioteca</span>
        </button>

        {canGoUp ? (
          <button
            className="breadcrumb-up-btn"
            onClick={handleGoUp}
            title="Subir un nivel"
            aria-label="Subir un nivel"
          >
            <Icon name="chevron-left" />
          </button>
        ) : null}

        <div className="breadcrumb-trail">
          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            return (
              <span key={seg.path} className="breadcrumb-segment-wrapper">
                <span className="breadcrumb-separator">/</span>
                {isLast ? (
                  <span className="breadcrumb-segment is-current" title={seg.path}>
                    {seg.name}
                  </span>
                ) : (
                  <button
                    className="breadcrumb-segment is-link"
                    onClick={() => onNavigate(seg.path)}
                    title={`Ir a ${seg.path}`}
                  >
                    {seg.name}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="breadcrumb-actions-group">
        {itemCount !== undefined ? (
          <span className="breadcrumb-count-badge">
            {itemCount} {itemCount === 1 ? "archivo" : "archivos"}
          </span>
        ) : null}

        {currentPath && onPlayFolder ? (
          <button
            className="breadcrumb-action-btn is-primary"
            onClick={() => onPlayFolder(currentPath)}
            title="Reproducir carpeta completa como cola"
          >
            <Icon name="play" />
            <span>Reproducir carpeta</span>
          </button>
        ) : null}

        {currentPath && onAddFolderToQueue ? (
          <button
            className="breadcrumb-action-btn"
            onClick={() => onAddFolderToQueue(currentPath)}
            title="Añadir canciones de esta carpeta a la cola"
          >
            <Icon name="queue" />
            <span>+ Cola</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}

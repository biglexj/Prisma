import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import type { MusicFolderSource, MusicLibraryItem } from "../../features/music_library/model/types";
import { FolderManager } from "../../features/music_library/ui/FolderManager";
import type { VisualFolderSource, VisualMediaKind } from "../../features/visual_library/model/types";
import { VisualSourceManager } from "../../features/visual_library/ui/VisualSourceManager";
import { Icon } from "../../shared/ui/Icon";
import { cleanPath } from "../../shared/mediaTree";
import { useScrollRestoration } from "../../shared/useScrollRestoration";
import { useCustomLibraries } from "../../features/custom_libraries/hooks/useCustomLibraries";
import type { CustomLibraryDefinition, CustomLibraryFolderSource } from "../../features/custom_libraries/model/types";
import {
  customLibrariesGetExcludedFolders,
  customLibrariesGetFolders,
  customLibrariesScanItems,
} from "../../features/custom_libraries/tauri/client";
import "./library-sources.css";

interface MusicSourceState {
  folders: MusicFolderSource[];
  excludedFolders: MusicFolderSource[];
  items: MusicLibraryItem[];
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  addFolder: (path: string) => Promise<void>;
  addExcludedFolder: (path: string) => Promise<void>;
  rescanFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  removeExcludedFolder: (path: string) => Promise<void>;
}

interface VisualSourceState {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  excludedFolders: VisualFolderSource[];
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  addFolder: (path: string) => Promise<void>;
  addExcludedFolder: (path: string) => Promise<void>;
  rescanFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  removeExcludedFolder: (path: string) => Promise<void>;
}

function ModularSourceCard({
  library,
  excluded = false,
  onAddFolder,
  onRemoveFolder,
}: {
  library: CustomLibraryDefinition;
  excluded?: boolean;
  onAddFolder: () => void;
  onRemoveFolder: (path: string) => void;
}) {
  const [folderSources, setFolderSources] = useState<CustomLibraryFolderSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const paths = excluded ? (library.excludedFolderPaths || []) : library.folderPaths;

  const loadCounts = useCallback(async () => {
    try {
      setLoadingSources(true);
      const res = excluded
        ? await customLibrariesGetExcludedFolders(library.id)
        : await customLibrariesGetFolders(library.id);
      setFolderSources(res);
    } catch {
      // fallback
    } finally {
      setLoadingSources(false);
    }
  }, [library.id, excluded]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, paths.length, library.folderPaths.length, library.excludedFolderPaths?.length]);

  const handleRescan = async (path: string) => {
    try {
      setBusyPath(path);
      await customLibrariesScanItems(library.id);
      await loadCounts();
    } finally {
      setBusyPath(null);
    }
  };

  const totalItems = folderSources.reduce((acc, f) => acc + f.count, 0);

  return (
    <section className="visual-source-manager modular-source-manager">
      <header>
        <div>
          <Icon name={library.icon as any} />
          <span>
            <strong>{excluded ? `${library.label} (Ocultas)` : library.label}</strong>
            <small>
              {totalItems} {excluded ? "ocultos" : "elementos"}
            </small>
          </span>
        </div>
        <button
          className="tonal-button"
          onClick={onAddFolder}
          type="button"
        >
          <Icon name="plus" /> {excluded ? "Ocultar" : "Añadir"}
        </button>
      </header>
      <div className="visual-source-list" aria-busy={loadingSources}>
        {paths.length === 0 ? (
          <p>{excluded ? "No hay carpetas ocultas." : "No hay carpetas registradas. Pulsa «Añadir» para asociar carpetas."}</p>
        ) : (
          paths.map((fPath) => {
            const folderName = fPath.split(/[\/\\]/).pop() || fPath;
            const source = folderSources.find((s) => s.path === fPath);
            const count = source ? source.count : 0;
            const available = source ? source.available : true;
            const busy = busyPath === fPath;

            return (
              <article key={fPath}>
                <span className={`source-status ${excluded ? "is-excluded" : available ? "is-ready" : ""}`}>
                  <i /> {excluded ? "Oculta del tiempo" : available ? "Disponible" : "No disponible"}
                </span>
                <strong>{folderName}</strong>
                <small title={cleanPath(fPath)}>{cleanPath(fPath)}</small>
                <b>{count}</b>
                <div>
                  {!excluded ? (
                    <button
                      className="icon-button"
                      aria-label={`Volver a escanear ${folderName}`}
                      disabled={busy || !available}
                      onClick={() => void handleRescan(fPath)}
                      title="Volver a escanear"
                      type="button"
                    >
                      <Icon name="refresh" className={busy ? "spinning-icon" : ""} />
                    </button>
                  ) : null}
                  <button
                    className="icon-button danger"
                    aria-label={`Quitar ${folderName}`}
                    disabled={busy}
                    onClick={() => onRemoveFolder(fPath)}
                    title={excluded ? "Mostrar en línea de tiempo" : "Quitar de Prisma"}
                    type="button"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function LibrarySources({
  music,
  images,
  videos,
  onPlay,
}: {
  music: MusicSourceState;
  images: VisualSourceState;
  videos: VisualSourceState;
  onPlay: (path: string) => void;
}) {
  useScrollRestoration("view:folders");
  const {
    libraries,
    addFolder: addCustomFolder,
    removeFolder: removeCustomFolder,
    addExcludedFolder: addCustomExcludedFolder,
    removeExcludedFolder: removeCustomExcludedFolder,
  } = useCustomLibraries();
  const activeCustomLibraries = libraries.filter((lib) => lib.isActive);

  const errors = [music.error, images.error, videos.error].filter(
    (error): error is string => Boolean(error),
  );

  const handleAddCustomFolder = async (libId: string, label: string) => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: `Añadir carpeta para ${label}`,
    });
    if (typeof selection === "string") {
      await addCustomFolder(libId, selection);
    }
  };

  const handleAddCustomExcludedFolder = async (libId: string, label: string) => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: `Ocultar subcarpeta en la línea de tiempo de ${label}`,
    });
    if (typeof selection === "string") {
      await addCustomExcludedFolder(libId, selection);
    }
  };

  const sourcesCount = 3 + activeCustomLibraries.length;
  const gridClass =
    sourcesCount <= 3 ? "library-sources-grid is-three-cols" : "library-sources-grid is-four-cols";

  return (
    <section className="library-sources">
      <header className="section-heading">
        <span className="preview-kicker">FUENTES DE LA BIBLIOTECA</span>
        <h1>Carpetas</h1>
        <p>Decide qué carpetas forman cada sección. Una misma ubicación puede registrarse para tipos diferentes.</p>
      </header>

      {errors.map((error) => (
        <div className="error-banner" key={error} role="alert">
          <strong>No se pudo actualizar una fuente</strong>
          <span>{error}</span>
        </div>
      ))}

      <div className="library-safety-note">
        <Icon name="folder" />
        <span>
          <strong>Tus archivos permanecen intactos.</strong> Quitar una fuente solo elimina su ruta guardada en Prisma.
        </span>
      </div>

      <div className={gridClass}>
        <FolderManager
          busyPath={music.busyPath}
          embedded
          error={null}
          folders={music.folders}
          items={music.items}
          loading={music.loading}
          onAdd={music.addFolder}
          onPlay={onPlay}
          onRemove={music.removeFolder}
          onRescan={music.rescanFolder}
        />
        <VisualSourceManager
          busyPath={images.busyPath}
          folders={images.folders}
          kind="image"
          loading={images.loading}
          onAdd={images.addFolder}
          onRemove={images.removeFolder}
          onRescan={images.rescanFolder}
        />
        <VisualSourceManager
          busyPath={videos.busyPath}
          folders={videos.folders}
          kind="video"
          loading={videos.loading}
          onAdd={videos.addFolder}
          onRemove={videos.removeFolder}
          onRescan={videos.rescanFolder}
        />

        {activeCustomLibraries.map((lib) => (
          <ModularSourceCard
            key={lib.id}
            library={lib}
            onAddFolder={() => void handleAddCustomFolder(lib.id, lib.label)}
            onRemoveFolder={(fPath) => void removeCustomFolder(lib.id, fPath)}
          />
        ))}
      </div>

      <header className="section-heading library-excluded-heading">
        <span className="preview-kicker">OCULTAR EN LÍNEA DE TIEMPO</span>
        <h2>Carpetas Ocultas del Tiempo</h2>
        <p>Especifica subcarpetas que Prisma no mostrará en la línea de tiempo ni feeds principales. Seguirán estando disponibles en las vistas de Carpetas y Árbol.</p>
      </header>

      <div className={gridClass}>
        <FolderManager
          busyPath={music.busyPath}
          embedded
          error={null}
          excluded
          folders={music.excludedFolders}
          items={[]}
          loading={music.loading}
          onAdd={music.addExcludedFolder}
          onPlay={onPlay}
          onRemove={music.removeExcludedFolder}
        />
        <VisualSourceManager
          busyPath={images.busyPath}
          excluded
          folders={images.excludedFolders}
          kind="image"
          loading={images.loading}
          onAdd={images.addExcludedFolder}
          onRemove={images.removeExcludedFolder}
        />
        <VisualSourceManager
          busyPath={videos.busyPath}
          excluded
          folders={videos.excludedFolders}
          kind="video"
          loading={videos.loading}
          onAdd={videos.addExcludedFolder}
          onRemove={videos.removeExcludedFolder}
        />

        {activeCustomLibraries.map((lib) => (
          <ModularSourceCard
            excluded
            key={`excluded-${lib.id}`}
            library={lib}
            onAddFolder={() => void handleAddCustomExcludedFolder(lib.id, lib.label)}
            onRemoveFolder={(fPath) => void removeCustomExcludedFolder(lib.id, fPath)}
          />
        ))}
      </div>
    </section>
  );
}

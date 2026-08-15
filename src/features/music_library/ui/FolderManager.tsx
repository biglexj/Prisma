import { open } from "@tauri-apps/plugin-dialog";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import { Icon } from "../../../shared/ui/Icon";
import { cleanPath } from "../../../shared/mediaTree";
import { MusicArtwork } from "./MusicArtwork";

const VISIBLE_TRACK_LIMIT = 160;

interface FolderManagerProps {
  folders: MusicFolderSource[];
  items: MusicLibraryItem[];
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  onAdd: (path: string) => Promise<void>;
  onRescan?: (path: string) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
  onPlay: (path: string) => void;
  embedded?: boolean;
  excluded?: boolean;
}

export function FolderManager({
  folders,
  items,
  loading,
  busyPath,
  error,
  onAdd,
  onRescan,
  onRemove,
  onPlay,
  embedded = false,
  excluded = false,
}: FolderManagerProps) {
  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: excluded
        ? "Seleccionar carpeta de música a ocultar en la línea de tiempo"
        : "Añadir carpeta de música a Prisma",
    });
    if (typeof selection === "string") {
      await onAdd(selection);
    }
  };

  if (embedded) {
    const totalTracks = folders.reduce((total, folder) => total + folder.trackCount, 0);
    return (
      <section className="visual-source-manager">
        <header>
          <div>
            <Icon name="music" />
            <span>
              <strong>{excluded ? "Música (Ocultas)" : "Música"}</strong>
              <small>{totalTracks} {excluded ? "ocultos" : "canciones"}</small>
            </span>
          </div>
          <button className="tonal-button" disabled={busyPath !== null} onClick={() => void chooseFolder()}>
            <Icon name="plus" /> {excluded ? "Ocultar" : "Añadir"}
          </button>
        </header>
        <div className="visual-source-list" aria-busy={loading}>
          {folders.length === 0 ? (
            <p>{excluded ? "No hay carpetas ocultas." : "No hay carpetas registradas."}</p>
          ) : (
            folders.map((folder) => {
              const isBusy = busyPath === folder.path;
              return (
                <article key={folder.path}>
                  <span className={excluded ? "source-status is-excluded" : folder.available ? "source-status is-ready" : "source-status"}>
                    <i /> {excluded ? "Oculta del tiempo" : folder.available ? "Disponible" : "No disponible"}
                  </span>
                  <strong>{folder.name}</strong>
                  <small title={cleanPath(folder.path)}>{cleanPath(folder.path)}</small>
                  <b>{folder.trackCount}</b>
                  <div>
                    {!excluded && onRescan ? (
                      <button
                        aria-label={`Volver a escanear ${folder.name}`}
                        className="icon-button"
                        disabled={isBusy || !folder.available}
                        onClick={() => void onRescan(folder.path)}
                        title="Volver a escanear"
                      >
                        <Icon name="refresh" />
                      </button>
                    ) : null}
                    <button
                      aria-label={excluded ? `Mostrar ${folder.name} en la línea de tiempo` : `Quitar ${folder.name} de Prisma`}
                      className="icon-button danger"
                      disabled={isBusy}
                      onClick={() => void onRemove(folder.path)}
                      title={excluded ? "Mostrar en línea de tiempo" : "Quitar de Prisma"}
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

  return (
    <section className="folder-manager">
      <header className="folder-manager-heading">
        <div className="section-heading">
          <span className="preview-kicker">FUENTE DE AUDIO</span>
          <h1>Carpetas</h1>
          <p>Registra carpetas raíz de música. Prisma escanea también sus subcarpetas.</p>
        </div>
        <button className="filled-button" disabled={busyPath !== null} onClick={() => void chooseFolder()}>
          <Icon name="plus" /> Añadir carpeta
        </button>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo actualizar la biblioteca</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="folder-safety-note">
        <Icon name="folder" />
        <span>
          <strong>Prisma solo registra la ubicación.</strong> Quitar una carpeta no borra ni mueve tus archivos.
        </span>
      </div>

      <div className="folder-source-list" aria-busy={loading}>
        {folders.length === 0 ? (
          <div className="empty-folder-state">
            <Icon name="folder" />
            <h2>{loading ? "Buscando carpetas…" : "Aún no hay carpetas añadidas"}</h2>
            <p>Empieza con tu carpeta principal de música; no necesitas añadir cada álbum por separado.</p>
            <button className="tonal-button" disabled={loading} onClick={() => void chooseFolder()}>
              Seleccionar carpeta
            </button>
          </div>
        ) : (
          folders.map((folder) => {
            const isBusy = busyPath === folder.path;
            return (
              <article className="folder-source-card" key={folder.path}>
                <div className="folder-source-icon">
                  <Icon name="folder" />
                </div>
                <div className="folder-source-copy">
                  <span className={folder.available ? "source-status is-ready" : "source-status"}>
                    <i /> {folder.available ? "Disponible" : "No disponible"}
                  </span>
                  <h2>{folder.name}</h2>
                  <p title={cleanPath(folder.path)}>{cleanPath(folder.path)}</p>
                </div>
                <strong className="folder-track-count">
                  {folder.trackCount}
                  <small> canciones</small>
                </strong>
                <div className="folder-source-actions">
                  <button
                    aria-label={`Volver a escanear ${folder.name}`}
                    className="icon-button"
                    disabled={isBusy || !folder.available}
                    onClick={() => void onRescan?.(folder.path)}
                    title="Volver a escanear"
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    aria-label={`Quitar ${folder.name} de Prisma`}
                    className="icon-button danger"
                    disabled={isBusy}
                    onClick={() => void onRemove(folder.path)}
                    title="Quitar de Prisma"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {items.length > 0 ? (
        <section className="recognized-tracks">
          <header>
            <div>
              <span className="preview-kicker">CONTENIDO RECONOCIDO</span>
              <h2>Canciones</h2>
            </div>
            <strong>{items.length} en total</strong>
          </header>
          <div className="track-list">
            {items.slice(0, VISIBLE_TRACK_LIMIT).map((item) => (
              <button className="track-row" key={item.path} onClick={() => onPlay(item.path)}>
                <span className="track-play">
                  <Icon name="play" />
                  <MusicArtwork alt={`Carátula de ${item.title}`} className="track-cover-artwork" path={item.path} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{cleanPath(item.relativeFolder)}</small>
                </span>
              </button>
            ))}
          </div>
          {items.length > VISIBLE_TRACK_LIMIT ? (
            <p className="track-limit-note">
              Se muestran las primeras {VISIBLE_TRACK_LIMIT} canciones para mantener la vista ligera.
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

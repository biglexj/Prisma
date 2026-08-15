import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { cleanPath } from "../../../shared/mediaTree";
import type { VisualFolderSource, VisualMediaKind } from "../model/types";

interface VisualSourceManagerProps {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  busyPath: string | null;
  loading: boolean;
  onAdd: (path: string) => Promise<void>;
  onRescan?: (path: string) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
  excluded?: boolean;
}

export function VisualSourceManager({
  kind,
  folders,
  busyPath,
  loading,
  onAdd,
  onRescan,
  onRemove,
  excluded = false,
}: VisualSourceManagerProps) {
  const label = kind === "image" ? "Imágenes" : "Vídeos";
  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: excluded
        ? `Seleccionar carpeta a ocultar de ${label.toLowerCase()} en la línea de tiempo`
        : `Añadir carpeta de ${label.toLowerCase()}`,
    });
    if (typeof selection === "string") await onAdd(selection);
  };

  return (
    <section className="visual-source-manager">
      <header>
        <div>
          <Icon name={kind === "image" ? "image" : "video"} />
          <span>
            <strong>{excluded ? `${label} (Ocultas)` : label}</strong>
            <small>
              {folders.reduce((total, folder) => total + folder.itemCount, 0)}{" "}
              {excluded ? "ocultos" : "elementos"}
            </small>
          </span>
        </div>
        <button
          className="tonal-button"
          disabled={busyPath !== null}
          onClick={() => void chooseFolder()}
        >
          <Icon name="plus" /> {excluded ? "Ocultar" : "Añadir"}
        </button>
      </header>
      <div className="visual-source-list" aria-busy={loading}>
        {folders.length === 0 ? (
          <p>{excluded ? "No hay carpetas ocultas." : "No hay carpetas registradas."}</p>
        ) : (
          folders.map((folder) => {
            const busy = busyPath === folder.path;
            return (
              <article key={`${folder.kind}-${folder.path}`}>
                <span className={excluded ? "source-status is-excluded" : folder.available ? "source-status is-ready" : "source-status"}>
                  <i /> {excluded ? "Oculta del tiempo" : folder.available ? "Disponible" : "No disponible"}
                </span>
                <strong>{folder.name}</strong>
                <small title={cleanPath(folder.path)}>{cleanPath(folder.path)}</small>
                <b>{folder.itemCount}</b>
                <div>
                  {!excluded && onRescan ? (
                    <button
                      className="icon-button"
                      aria-label={`Volver a escanear ${folder.name}`}
                      disabled={busy || !folder.available}
                      onClick={() => void onRescan(folder.path)}
                    >
                      <Icon name="refresh" />
                    </button>
                  ) : null}
                  <button
                    className="icon-button danger"
                    aria-label={excluded ? `Mostrar ${folder.name} en la línea de tiempo` : `Quitar ${folder.name}`}
                    disabled={busy}
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

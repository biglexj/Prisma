import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../shared/ui/Icon";
import { handleNativeDragPointerDown } from "../../shared/useNativeFileDrag";
import { loadDropZonePreferences } from "../useSystemSettings";
import "./file-drop-zone.css";

/** Evento que la bóveda envía a la ventana principal. */
export const SYSTEM_DROP_EVENT = "prisma:system-drop";

/** Evento para enviar un elemento de la bóveda al teléfono. */
export const VAULT_SEND_EVENT = "prisma:vault-send";

export interface VaultItem {
  id: string;
  name: string;
  path?: string | null;
  url?: string | null;
  kind: "image" | "video" | "file";
  size: number;
  pinned: boolean;
  addedAt: number;
}

const CARD_WIDTH = 78;
const CARD_GAP = 8;
const SHELF_HEIGHT = 76;

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Bóveda flotante del sistema.
 *
 * Vive en una ventana propia, siempre encima, en el borde superior central de
 * la pantalla. Guarda hasta tres elementos: el primero se puede fijar y no se
 * expulsa nunca. Desde cada elemento se puede enviar al teléfono, guardar en
 * una carpeta o arrastrarlo fuera hacia el Explorador, que hace una copia.
 */
export function SystemDropZone() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [folder, setFolder] = useState("");
  const isDragOverRef = useRef(false);

  const refresh = useCallback(async () => {
    const list = await invoke<VaultItem[]>("vault_list").catch(() => []);
    setItems(list);
    return list;
  }, []);

  useEffect(() => {
    // La webview arranca antes de que el backend registre el estado de la
    // bóveda: se reintenta unas veces hasta que responda.
    let cancelled = false;
    const attempt = async (remaining: number) => {
      if (cancelled) return;
      const list = await invoke<VaultItem[]>("vault_list").catch(() => null);
      if (cancelled) return;
      if (list) {
        setItems(list);
        return;
      }
      if (remaining > 0) setTimeout(() => void attempt(remaining - 1), 400);
    };
    void attempt(12);
    void invoke<string>("drop_zone_default_folder")
      .then((value) => setFolder(value))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // La ventana se dimensiona según lo que hay en la bóveda: una muesca de
  // 80 × 3 px cuando está vacía, la estantería cuando tiene elementos.
  const shelfWidth = useMemo(
    () => (items.length === 0 ? 80 : items.length * CARD_WIDTH + (items.length - 1) * CARD_GAP + 16),
    [items.length]
  );
  const shelfHeight = items.length === 0 ? 3 : SHELF_HEIGHT;

  useEffect(() => {
    void invoke("system_drop_zone_set_size", { width: shelfWidth, height: shelfHeight }).catch(
      () => {}
    );
  }, [shelfHeight, shelfWidth]);

  // Los eventos nativos son los que traen las rutas: el DOM no expone archivos
  // del sistema operativo.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    try {
      const webview = getCurrentWebview();
      webview
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "over") {
            isDragOverRef.current = true;
            setIsDragOver(true);
            return;
          }
          if (payload.type === "leave") {
            isDragOverRef.current = false;
            setIsDragOver(false);
            return;
          }
          if (payload.type === "drop") {
            const paths = payload.paths ?? [];
            isDragOverRef.current = false;
            setIsDragOver(false);
            if (paths.length === 0) return;
            void (async () => {
              for (const path of paths) {
                await invoke("vault_add", { path, url: null }).catch(() => {});
              }
              await refresh();
            })();
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch(() => undefined);
    } catch {
      // Fuera del contexto de webview no hay bóveda.
    }

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [refresh]);

  const handleRemove = useCallback(
    async (id: string) => {
      setItems(await invoke<VaultItem[]>("vault_remove", { id }).catch(() => []));
    },
    []
  );

  const handleTogglePin = useCallback(async (id: string) => {
    setItems(await invoke<VaultItem[]>("vault_toggle_pin", { id }).catch(() => []));
  }, []);

  const handleSend = useCallback(async (item: VaultItem) => {
    if (!item.path) return;
    await emitTo("main", VAULT_SEND_EVENT, { path: item.path, title: item.name }).catch(() => {});
  }, []);

  const handleSave = useCallback(
    async (item: VaultItem) => {
      if (!item.path) return;
      const preferences = loadDropZonePreferences();
      const target = preferences.folder || folder;
      if (!target) return;
      await invoke("drop_zone_copy_file", { sourcePath: item.path, folder: target }).catch(() => {});
    },
    [folder]
  );

  return (
    <div className={`vault-shelf ${isDragOver ? "is-drag-over" : ""}`}>
      {items.length === 0 && (
        <span className="file-drop-zone-notch" aria-hidden="true" />
      )}

      {items.length > 0 && (
        <div className="vault-items">
          {items.map((item) => (
            <div
              key={item.id}
              className={`vault-card ${item.pinned ? "is-pinned" : ""}`}
              onPointerDown={(event) => {
                if (!item.path) return;
                handleNativeDragPointerDown(event, item.path, { mode: "copy" });
              }}
              title={`${item.name}${item.size ? ` · ${formatBytes(item.size)}` : ""}\nArrastra para copiarlo donde quieras`}
            >
              <div className="vault-card-preview">
                {item.kind === "image" && item.path ? (
                  <img src={convertFileSrc(item.path)} alt="" draggable={false} />
                ) : (
                  <Icon
                    name={item.kind === "video" ? "film" : "file"}
                    width={20}
                    height={20}
                  />
                )}
                {item.pinned && (
                  <span className="vault-card-pin" title="Fijado: no se expulsa">
                    <Icon name="pin" width={10} height={10} />
                  </span>
                )}
              </div>

              <span className="vault-card-name">{item.name}</span>

              <div className="vault-card-actions">
                <button
                  type="button"
                  onClick={() => void handleSend(item)}
                  title="Enviar al teléfono (Super Galería)"
                >
                  <Icon name="smartphone" width={12} height={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave(item)}
                  title="Guardar una copia en la carpeta"
                >
                  <Icon name="folder" width={12} height={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleTogglePin(item.id)}
                  title={item.pinned ? "Desfijar" : "Fijar: siempre primero y no se expulsa"}
                >
                  <Icon name="pin" width={12} height={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove(item.id)}
                  title="Quitar de la bóveda"
                >
                  <Icon name="close" width={12} height={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDragOver && items.length === 0 && (
        <div className="vault-drop-hint">Suelta el archivo para guardarlo aquí</div>
      )}
    </div>
  );
}

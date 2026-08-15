import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { useFavorites } from "./useFavorites";
import { deleteMediaItems } from "./mediaDelete";

export type MediaDeleteKind = "music" | "image" | "video";

export interface MediaDeletableItem {
  path: string;
  title: string;
  kind: MediaDeleteKind;
}

interface UseMediaDeleteOptions {
  /** Si true se muestra el diálogo de confirmación antes de borrar. */
  confirmDeletion: boolean;
  /** Se invoca tras borrar con éxito para refrescar la biblioteca. */
  onRefresh?: () => void | Promise<void>;
  /** Callback opcional al confirmar la eliminación de un elemento. */
  onDeleted?: (item: MediaDeletableItem) => void;
}

export function useMediaDelete({ confirmDeletion, onRefresh, onDeleted }: UseMediaDeleteOptions) {
  const favorites = useFavorites();
  const [menu, setMenu] = useState<{ item: MediaDeletableItem; x: number; y: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaDeletableItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openMenu = useCallback((event: MouseEvent, item: MediaDeletableItem) => {
    event.preventDefault();
    setMenu({ item, x: event.clientX, y: event.clientY });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const performDelete = useCallback(
    async (item: MediaDeletableItem) => {
      setDeleting(true);
      setDeleteError(null);
      try {
        const result = await deleteMediaItems([item.path]);
        if (result.deleted > 0) {
          favorites.removeFavorite(item.path, item.kind);
          onDeleted?.(item);
          await onRefresh?.();
        }
        if (result.errors.length > 0) {
          setDeleteError(result.errors.join("\n"));
        }
      } catch (reason) {
        setDeleteError(String(reason));
      } finally {
        setDeleting(false);
      }
    },
    [favorites, onDeleted, onRefresh],
  );

  const requestDelete = useCallback(
    (item: MediaDeletableItem) => {
      if (confirmDeletion) {
        setPendingDelete(item);
      } else {
        void performDelete(item);
      }
    },
    [confirmDeletion, performDelete],
  );

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    void performDelete(item);
  }, [pendingDelete, performDelete]);

  return {
    menu,
    openMenu,
    closeMenu,
    pendingDelete,
    deleting,
    deleteError,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}

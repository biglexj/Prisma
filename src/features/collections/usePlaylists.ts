import { useCallback, useEffect, useState } from "react";
import type { PlaylistItem, PlaylistMeta } from "./model/types";
import {
  playlistsAddFiles,
  playlistsAddItem,
  playlistsCleanMissing,
  playlistsCreate,
  playlistsDelete,
  playlistsImport,
  playlistsList,
  playlistsRead,
  playlistsRelinkFolder,
  playlistsRelinkItem,
  playlistsRemoveItem,
  playlistsSaveFromItems,
  playlistsToggleHidden,
} from "./tauri/client";

// Caché en memoria para evitar re-escanear todo el disco al cambiar de pestaña
let cachedPlaylists: PlaylistMeta[] | null = null;
let cachedSelectedPlaylist: PlaylistMeta | null = null;
let cachedSelectedItems: PlaylistItem[] = [];

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>(cachedPlaylists ?? []);
  const [loading, setLoading] = useState(cachedPlaylists === null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistMeta | null>(cachedSelectedPlaylist);
  const [selectedItems, setSelectedItems] = useState<PlaylistItem[]>(cachedSelectedItems);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading && cachedPlaylists === null) {
      setLoading(true);
    }
    try {
      const list = await playlistsList();
      cachedPlaylists = list;
      setPlaylists(list);

      // Sincronizar el meta del playlist seleccionado con el objeto fresco de la lista
      if (cachedSelectedPlaylist) {
        const freshMeta = list.find(
          (p) => p.path.toLowerCase() === cachedSelectedPlaylist!.path.toLowerCase()
        );
        if (freshMeta) {
          cachedSelectedPlaylist = freshMeta;
          setSelectedPlaylist(freshMeta);
        }
      }
    } catch (err) {
      console.error("Error listando playlists:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Si no hay listas en caché, cargamos con indicador de carga
    if (cachedPlaylists === null) {
      void refresh(true);
    } else {
      // Si ya hay listas en caché, refrescar silenciosamente en segundo plano (stale-while-revalidate)
      void refresh(false);
    }
    // Si hay un playlist seleccionado pero sin ítems en caché (caché stale),
    // re-leer del disco en segundo plano.
    if (cachedSelectedPlaylist !== null && cachedSelectedItems.length === 0) {
      void selectPlaylist(cachedSelectedPlaylist);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intencional: solo al montar

  const selectPlaylist = useCallback(async (meta: PlaylistMeta | null) => {
    cachedSelectedPlaylist = meta;
    setSelectedPlaylist(meta);
    if (!meta) {
      cachedSelectedItems = [];
      setSelectedItems([]);
      return;
    }
    setLoadingItems(true);
    try {
      const items = await playlistsRead(meta.path);
      cachedSelectedItems = items;
      setSelectedItems(items);
    } catch (err) {
      console.error("Error leyendo playlist:", err);
      cachedSelectedItems = [];
      setSelectedItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const create = useCallback(
    async (name: string, kind?: "music" | "video") => {
      try {
        const meta = await playlistsCreate(name, kind);
        await refresh(false);
        await selectPlaylist(meta);
        return meta;
      } catch (err) {
        console.error("Error creando playlist:", err);
        throw err;
      }
    },
    [refresh, selectPlaylist]
  );

  const saveFromItems = useCallback(
    async (name: string, items: PlaylistItem[]) => {
      try {
        const meta = await playlistsSaveFromItems(name, items);
        await refresh(false);
        await selectPlaylist(meta);
        return meta;
      } catch (err) {
        console.error("Error guardando lista:", err);
        throw err;
      }
    },
    [refresh, selectPlaylist]
  );

  const importPlaylist = useCallback(
    async (filePath: string) => {
      try {
        const meta = await playlistsImport(filePath);
        await refresh(false);
        await selectPlaylist(meta);
        return meta;
      } catch (err) {
        console.error("Error importando lista:", err);
        throw err;
      }
    },
    [refresh, selectPlaylist]
  );

  const deletePlaylist = useCallback(
    async (path: string) => {
      try {
        await playlistsDelete(path);
        if (selectedPlaylist?.path === path) {
          cachedSelectedPlaylist = null;
          cachedSelectedItems = [];
          setSelectedPlaylist(null);
          setSelectedItems([]);
        }
        await refresh(false);
      } catch (err) {
        console.error("Error eliminando playlist:", err);
        throw err;
      }
    },
    [refresh, selectedPlaylist]
  );

  const toggleHidden = useCallback(
    async (path: string) => {
      try {
        await playlistsToggleHidden(path);
        await refresh(false);
      } catch (err) {
        console.error("Error cambiando visibilidad de playlist:", err);
        throw err;
      }
    },
    [refresh]
  );

  const cleanMissingItems = useCallback(
    async (path: string) => {
      try {
        const updated = await playlistsCleanMissing(path);
        cachedSelectedItems = updated;
        setSelectedItems(updated);
        setSelectedPlaylist((prev) => {
          if (!prev || prev.path !== path) return prev;
          const validCount = updated.filter((it) => it.isAvailable !== false).length;
          const updatedMeta: PlaylistMeta = {
            ...prev,
            validCount,
            itemCount: updated.length,
          };
          cachedSelectedPlaylist = updatedMeta;
          return updatedMeta;
        });
        await refresh(false);
      } catch (err) {
        console.error("Error limpiando pistas no encontradas:", err);
        throw err;
      }
    },
    [refresh]
  );

  const relinkItem = useCallback(
    async (playlistPath: string, oldItemPath: string, newItemPath: string, itemIndex?: number) => {
      try {
        const updated = await playlistsRelinkItem(playlistPath, oldItemPath, newItemPath, itemIndex);
        cachedSelectedItems = updated;
        setSelectedItems(updated);
        setSelectedPlaylist((prev) => {
          if (!prev || prev.path !== playlistPath) return prev;
          const validCount = updated.filter((it) => it.isAvailable !== false).length;
          const updatedMeta: PlaylistMeta = {
            ...prev,
            validCount,
            itemCount: updated.length,
          };
          cachedSelectedPlaylist = updatedMeta;
          return updatedMeta;
        });
        await refresh(false);
        return updated;
      } catch (err) {
        console.error("Error reconectando pista:", err);
        throw err;
      }
    },
    [refresh]
  );

  const relinkFolder = useCallback(
    async (playlistPath: string, searchFolder: string) => {
      try {
        const result = await playlistsRelinkFolder(playlistPath, searchFolder);
        cachedSelectedItems = result.updatedItems;
        setSelectedItems(result.updatedItems);
        setSelectedPlaylist((prev) => {
          if (!prev || prev.path !== playlistPath) return prev;
          const validCount = result.updatedItems.filter((it) => it.isAvailable !== false).length;
          const updatedMeta: PlaylistMeta = {
            ...prev,
            validCount,
            itemCount: result.updatedItems.length,
          };
          cachedSelectedPlaylist = updatedMeta;
          return updatedMeta;
        });
        await refresh(false);
        return result;
      } catch (err) {
        console.error("Error reconectando pistas desde carpeta:", err);
        throw err;
      }
    },
    [refresh]
  );

  const addItem = useCallback(
    async (playlistPath: string, itemPath: string, itemTitle: string, itemDuration = 0) => {
      try {
        const count = await playlistsAddItem(playlistPath, itemPath, itemTitle, itemDuration);
        if (selectedPlaylist && selectedPlaylist.path === playlistPath) {
          await selectPlaylist(selectedPlaylist);
        }
        await refresh(false);
        return count;
      } catch (err) {
        console.error("Error añadiendo a playlist:", err);
        throw err;
      }
    },
    [refresh, selectPlaylist, selectedPlaylist]
  );

  const removeItem = useCallback(
    async (playlistPath: string, itemPath: string) => {
      try {
        const count = await playlistsRemoveItem(playlistPath, itemPath);
        if (selectedPlaylist && selectedPlaylist.path === playlistPath) {
          await selectPlaylist(selectedPlaylist);
        }
        await refresh(false);
        return count;
      } catch (err) {
        console.error("Error removiendo de playlist:", err);
        throw err;
      }
    },
    [refresh, selectPlaylist, selectedPlaylist]
  );

  /** Añade uno o más archivos a la lista y persiste en disco inmediatamente. */
  const addFiles = useCallback(
    async (playlistPath: string, filePaths: string[]) => {
      if (filePaths.length === 0) return;
      try {
        const updated = await playlistsAddFiles(playlistPath, filePaths);
        // Actualizar caché y estado de forma síncrona con lo que devuelve Rust
        cachedSelectedItems = updated;
        setSelectedItems(updated);
        setSelectedPlaylist((prev) => {
          if (!prev || prev.path !== playlistPath) return prev;
          const validCount = updated.filter((it) => it.isAvailable !== false).length;
          const updatedMeta: PlaylistMeta = {
            ...prev,
            itemCount: updated.length,
            validCount,
          };
          cachedSelectedPlaylist = updatedMeta;
          return updatedMeta;
        });
        await refresh(false);
        return updated;
      } catch (err) {
        console.error("Error añadiendo archivos a playlist:", err);
        throw err;
      }
    },
    [refresh]
  );

  return {
    playlists,
    loading,
    refresh: () => refresh(true),
    selectedPlaylist,
    selectedItems,
    loadingItems,
    showHidden,
    setShowHidden,
    selectPlaylist,
    create,
    saveFromItems,
    importPlaylist,
    deletePlaylist,
    toggleHidden,
    cleanMissingItems,
    relinkItem,
    relinkFolder,
    addItem,
    addFiles,
    removeItem,
  };
}

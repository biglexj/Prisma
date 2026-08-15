import { useCallback, useEffect, useState } from "react";
import type { MusicFolderSource, MusicLibraryItem } from "./model/types";
import { musicLibraryClient } from "./tauri/client";

export function useMusicLibrary() {
  const [folders, setFolders] = useState<MusicFolderSource[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<MusicFolderSource[]>([]);
  const [items, setItems] = useState<MusicLibraryItem[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextFolders, nextExcluded, nextItems] = await Promise.all([
        musicLibraryClient.listFolders(),
        musicLibraryClient.listExcludedFolders(),
        musicLibraryClient.listItems(),
      ]);
      setFolders(nextFolders);
      setExcludedFolders(nextExcluded);
      setItems(nextItems);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runFolderAction = useCallback(
    async (path: string, action: () => Promise<unknown>) => {
      setBusyPath(path);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (reason) {
        setError(String(reason));
      } finally {
        setBusyPath(null);
      }
    },
    [refresh],
  );

  return {
    folders,
    excludedFolders,
    items,
    busyPath,
    loading,
    error,
    addFolder: (path: string) => runFolderAction(path, () => musicLibraryClient.addFolder(path)),
    addExcludedFolder: (path: string) =>
      runFolderAction(path, () => musicLibraryClient.addExcludedFolder(path)),
    rescanFolder: (path: string) =>
      runFolderAction(path, () => musicLibraryClient.rescanFolder(path)),
    removeFolder: (path: string) =>
      runFolderAction(path, () => musicLibraryClient.removeFolder(path)),
    removeExcludedFolder: (path: string) =>
      runFolderAction(path, () => musicLibraryClient.removeExcludedFolder(path)),
    refresh,
  };
}

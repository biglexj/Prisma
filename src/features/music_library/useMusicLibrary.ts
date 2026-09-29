import { useCallback, useEffect, useState } from "react";
import type { MusicFolderSource, MusicLibraryItem } from "./model/types";
import { musicLibraryClient } from "./tauri/client";
import { scheduleLibraryScan } from "../../shared/libraryScanScheduler";

export function useMusicLibrary() {
  const [folders, setFolders] = useState<MusicFolderSource[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<MusicFolderSource[]>([]);
  const [items, setItems] = useState<MusicLibraryItem[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const [nextFolders, nextExcluded] = await Promise.all([
        musicLibraryClient.listFolders(),
        musicLibraryClient.listExcludedFolders(),
      ]);
      setFolders(nextFolders);
      setExcludedFolders(nextExcluded);
      setSourcesLoaded(true);
      const nextItems = await scheduleLibraryScan(() => musicLibraryClient.listItems());
      setItems(nextItems);
    } catch (reason) {
      const msg = String(reason);
      if (msg.includes("state not managed") && retryCount < 4) {
        setTimeout(() => {
          void refresh(retryCount + 1);
        }, 200);
        return;
      }
      setSourcesLoaded(true);
      setError(msg);
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
    sourcesLoaded,
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

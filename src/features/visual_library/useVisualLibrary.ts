import { useCallback, useEffect, useState } from "react";
import type {
  VisualFolderSource,
  VisualLibraryItem,
  VisualMediaKind,
} from "./model/types";
import { visualLibraryClient } from "./tauri/client";
import { scheduleLibraryScan } from "../../shared/libraryScanScheduler";

export function useVisualLibrary(kind: VisualMediaKind) {
  const [folders, setFolders] = useState<VisualFolderSource[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<VisualFolderSource[]>([]);
  const [items, setItems] = useState<VisualLibraryItem[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const [nextFolders, nextExcluded] = await Promise.all([
        visualLibraryClient.listFolders(kind),
        visualLibraryClient.listExcludedFolders(kind),
      ]);
      setFolders(nextFolders);
      setExcludedFolders(nextExcluded);
      setSourcesLoaded(true);
      const nextItems = await scheduleLibraryScan(() => visualLibraryClient.listItems(kind));
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
  }, [kind]);

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
    kind,
    folders,
    excludedFolders,
    items,
    busyPath,
    loading,
    sourcesLoaded,
    error,
    addFolder: (path: string) =>
      runFolderAction(path, () => visualLibraryClient.addFolder(path, kind)),
    addExcludedFolder: (path: string) =>
      runFolderAction(path, () => visualLibraryClient.addExcludedFolder(path, kind)),
    rescanFolder: (path: string) =>
      runFolderAction(path, () => visualLibraryClient.rescanFolder(path, kind)),
    removeFolder: (path: string) =>
      runFolderAction(path, () => visualLibraryClient.removeFolder(path, kind)),
    removeExcludedFolder: (path: string) =>
      runFolderAction(path, () => visualLibraryClient.removeExcludedFolder(path, kind)),
    refresh,
  };
}

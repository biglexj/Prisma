import { useState } from "react";
import { renameMediaItem, type RenameMediaResult } from "./mediaOperations";

export interface RenameTarget {
  path: string;
  title: string;
  kind?: string;
}

interface UseMediaRenameOptions {
  onRefresh?: () => void | Promise<void>;
  onRenamed?: (result: RenameMediaResult) => void;
}

export function useMediaRename(options: UseMediaRenameOptions = {}) {
  const { onRefresh, onRenamed } = options;
  const [pendingRename, setPendingRename] = useState<RenameTarget | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const requestRename = (item: RenameTarget) => {
    setPendingRename(item);
    setRenameError(null);
  };

  const cancelRename = () => {
    setPendingRename(null);
    setRenameError(null);
  };

  const confirmRename = async (newName: string): Promise<RenameMediaResult> => {
    if (!pendingRename) throw new Error("No hay un archivo seleccionado para renombrar");

    try {
      const result = await renameMediaItem(pendingRename.path, newName);
      setPendingRename(null);
      setRenameError(null);
      onRenamed?.(result);
      await onRefresh?.();
      return result;
    } catch (err: any) {
      const msg = err?.message || String(err) || "Error al renombrar";
      setRenameError(msg);
      throw err;
    }
  };

  return {
    pendingRename,
    renameError,
    requestRename,
    cancelRename,
    confirmRename,
  };
}

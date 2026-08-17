import { useCallback, useEffect, useState } from "react";
import type { CustomLibraryDefinition } from "../model/types";
import {
  customLibrariesAddExcludedFolder,
  customLibrariesAddFolder,
  customLibrariesDelete,
  customLibrariesGetAll,
  customLibrariesRemoveExcludedFolder,
  customLibrariesRemoveFolder,
  customLibrariesSave,
  customLibrariesToggleActive,
} from "../tauri/client";

let globalLibraries: CustomLibraryDefinition[] = [];
let isLoaded = false;
const listeners = new Set<(libs: CustomLibraryDefinition[]) => void>();

function notify(libs: CustomLibraryDefinition[]) {
  globalLibraries = libs;
  isLoaded = true;
  for (const listener of listeners) {
    listener(libs);
  }
}

export function useCustomLibraries() {
  const [libraries, setLibraries] = useState<CustomLibraryDefinition[]>(() => globalLibraries);
  const [loading, setLoading] = useState(!isLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setLibraries);
    return () => {
      listeners.delete(setLibraries);
    };
  }, []);

  const loadLibraries = useCallback(async () => {
    try {
      if (!isLoaded) setLoading(true);
      setError(null);
      const res = await customLibrariesGetAll();
      notify(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      void loadLibraries();
    }
  }, [loadLibraries]);

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const updated = await customLibrariesToggleActive(id, active);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveLibrary = async (def: CustomLibraryDefinition) => {
    try {
      const updated = await customLibrariesSave(def);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteLibrary = async (id: string) => {
    try {
      const updated = await customLibrariesDelete(id);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const addFolder = async (id: string, path: string) => {
    try {
      const updated = await customLibrariesAddFolder(id, path);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeFolder = async (id: string, path: string) => {
    try {
      const updated = await customLibrariesRemoveFolder(id, path);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const addExcludedFolder = async (id: string, path: string) => {
    try {
      const updated = await customLibrariesAddExcludedFolder(id, path);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeExcludedFolder = async (id: string, path: string) => {
    try {
      const updated = await customLibrariesRemoveExcludedFolder(id, path);
      notify(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const activeLibraries = libraries.filter((l) => l.isActive);

  return {
    libraries,
    activeLibraries,
    loading,
    error,
    refresh: loadLibraries,
    toggleActive,
    saveLibrary,
    deleteLibrary,
    addFolder,
    removeFolder,
    addExcludedFolder,
    removeExcludedFolder,
  };
}

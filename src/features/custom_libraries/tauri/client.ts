import { invoke } from "@tauri-apps/api/core";
import type {
  CustomLibraryDefinition,
  CustomLibraryFolderSource,
  CustomLibraryItem,
} from "../model/types";

export async function customLibrariesGetAll(): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_get_all");
}

export async function customLibrariesSave(
  definition: CustomLibraryDefinition
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_save", { definition });
}

export async function customLibrariesToggleActive(
  id: string,
  active: boolean
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_toggle_active", {
    id,
    active,
  });
}

export async function customLibrariesDelete(id: string): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_delete", { id });
}

export async function customLibrariesAddFolder(
  id: string,
  folderPath: string
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_add_folder", {
    id,
    folderPath,
  });
}

export async function customLibrariesRemoveFolder(
  id: string,
  folderPath: string
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_remove_folder", {
    id,
    folderPath,
  });
}

export async function customLibrariesAddExcludedFolder(
  id: string,
  folderPath: string
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_add_excluded_folder", {
    id,
    folderPath,
  });
}

export async function customLibrariesRemoveExcludedFolder(
  id: string,
  folderPath: string
): Promise<CustomLibraryDefinition[]> {
  return await invoke<CustomLibraryDefinition[]>("custom_libraries_remove_excluded_folder", {
    id,
    folderPath,
  });
}

export async function customLibrariesGetFolders(
  id: string
): Promise<CustomLibraryFolderSource[]> {
  return await invoke<CustomLibraryFolderSource[]>("custom_libraries_get_folders", { id });
}

export async function customLibrariesGetExcludedFolders(
  id: string
): Promise<CustomLibraryFolderSource[]> {
  return await invoke<CustomLibraryFolderSource[]>("custom_libraries_get_excluded_folders", { id });
}

export async function customLibrariesScanItems(id: string): Promise<CustomLibraryItem[]> {
  return await invoke<CustomLibraryItem[]>("custom_libraries_scan_items", { id });
}

export async function customLibrariesGetThumbnail(path: string): Promise<string | null> {
  return await invoke<string | null>("custom_libraries_get_thumbnail", { path });
}

export async function customLibrariesReadTextFile(path: string): Promise<string> {
  return await invoke<string>("custom_libraries_read_text_file", { path });
}

export async function customLibrariesSaveTextFile(
  path: string,
  content: string
): Promise<void> {
  return await invoke("custom_libraries_save_text_file", { path, content });
}

export async function customLibrariesOpenFile(
  path: string,
  customCommand?: string | null
): Promise<void> {
  return await invoke("custom_libraries_open_file", {
    path,
    customCommand: customCommand || null,
  });
}

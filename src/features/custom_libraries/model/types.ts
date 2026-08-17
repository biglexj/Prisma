export interface CustomLibraryDefinition {
  id: string;
  label: string;
  icon: string;
  extensions: string[];
  externalAppCommand?: string | null;
  folderPaths: string[];
  excludedFolderPaths?: string[];
  isPreset: boolean;
  isActive: boolean;
  description?: string | null;
}

export interface CustomLibraryItem {
  path: string;
  name: string;
  extension: string;
  relativeFolder: string;
  sizeBytes: number;
  modifiedTimestamp: number;
}

export interface CustomLibraryFolderSource {
  path: string;
  available: boolean;
  count: number;
}

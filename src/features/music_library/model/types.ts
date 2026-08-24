export interface MusicFolderSource {
  path: string;
  name: string;
  trackCount: number;
  available: boolean;
}

export interface MusicLibraryItem {
  path: string;
  title: string;
  /** Indica que el título proviene de una etiqueta incrustada y no debe reinterpretarse. */
  titleFromMetadata?: boolean;
  artist?: string;
  album?: string;
  sourcePath: string;
  relativeFolder: string;
  modifiedAtMillis?: number;
  sizeBytes?: number;
  isExcluded?: boolean;
}

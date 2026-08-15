export interface MusicFolderSource {
  path: string;
  name: string;
  trackCount: number;
  available: boolean;
}

export interface MusicLibraryItem {
  path: string;
  title: string;
  sourcePath: string;
  relativeFolder: string;
  modifiedAtMillis?: number;
  sizeBytes?: number;
  isExcluded?: boolean;
}

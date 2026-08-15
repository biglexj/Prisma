export type VisualMediaKind = "image" | "video";

export interface VisualFolderSource {
  path: string;
  name: string;
  kind: VisualMediaKind;
  itemCount: number;
  available: boolean;
}

export interface VisualLibraryItem {
  path: string;
  title: string;
  sourcePath: string;
  relativeFolder: string;
  kind: VisualMediaKind;
  modifiedAtMillis: number;
  sizeBytes: number;
}

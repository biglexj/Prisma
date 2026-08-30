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
  isExcluded?: boolean;
}

export interface ImageExifData {
  path: string;
  fileName: string;
  fileSizeBytes: number;
  format: string;
  width: number;
  height: number;
  aspectRatio: string;
  megapixels: number;
  cameraMake?: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  dateTaken?: string | null;
  iso?: string | null;
  aperture?: string | null;
  shutterSpeed?: string | null;
  focalLength?: string | null;
  exposureBias?: string | null;
  flash?: string | null;
  whiteBalance?: string | null;
  meteringMode?: string | null;
  software?: string | null;
  colorSpace?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

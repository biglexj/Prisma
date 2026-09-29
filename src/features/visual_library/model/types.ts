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
  kind: VisualMediaKind | "audio";
  modifiedAtMillis: number;
  createdAtMillis?: number;
  sizeBytes: number;
  isExcluded?: boolean;
}

export interface FolderVisualItemsResult {
  folderName: string;
  targetIndex: number;
  items: VisualLibraryItem[];
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

export interface DuplicateCandidate {
  path: string;
  title: string;
  relativeFolder: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  modifiedAtMillis: number;
  similarityPct: number;
  isExactMatch: boolean;
  isFromBaseFolder?: boolean;
  hasHigherResolution?: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  matchType: "exact" | "perceptual";
  original: DuplicateCandidate;
  duplicates: DuplicateCandidate[];
  hasResolutionUpgrade?: boolean;
}

export interface DuplicateScanOptions {
  paths: string[];
  minSimilarityPct: number;
  checkVisualSimilarity: boolean;
  minSizeBytes?: number;
  baseFolder?: string;
  targetFolder?: string;
  preferHigherResolution?: boolean;
}

export type TakeStatus = "good_take" | "reject" | "b_roll" | "pending";

export type ClipColor =
  | "orange"
  | "apricot"
  | "yellow"
  | "lime"
  | "olive"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "purple"
  | "violet"
  | "pink"
  | "tan"
  | "beige"
  | "brown"
  | "chocolate"
  | "none";

export interface VideoTakeMarker {
  path: string;
  status: TakeStatus;
  clip_color: ClipColor;
  rating?: number | null;
  note?: string | null;
  updated_at: number;
}

export interface VideoTechnicalMetadata {
  path: string;
  width: number;
  height: number;
  aspect_ratio: string;
  codec: string;
  codec_display: string;
  profile?: string | null;
  pixel_format: string;
  bit_depth: number;
  fps: number;
  fps_fraction: string;
  duration_secs: number;
  bitrate_bps?: number | null;
  bitrate_display: string;
  color_space?: string | null;
  color_transfer?: string | null;
  color_primaries?: string | null;
  color_range?: string | null;
  is_hdr: boolean;
  log_curve?: string | null;
  camera_make?: string | null;
  camera_model?: string | null;
  creation_time?: string | null;
  audio_codec?: string | null;
  audio_channels: number;
  audio_sample_rate: number;
}


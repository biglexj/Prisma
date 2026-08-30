export type QuickLookMediaType =
  | "audio"
  | "video"
  | "image"
  | "pdf"
  | "text"
  | "markdown"
  | "html"
  | "lyrics"
  | "folder"
  | "archive"
  | "epub"
  | "project"
  | "playlist"
  | "generic";

export interface ArchiveEntryInfo {
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  isDir: boolean;
}

export interface QuickLookPayload {
  path: string;
  fileName: string;
  mediaType: QuickLookMediaType;
  fileSizeBytes: number;
  formattedSize: string;
  trackTitle?: string | null;
  trackArtist?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  folderItemsCount?: number | null;
  folderPreviewItems?: string[] | null;
  textContent?: string | null;
  projectPreviewUrl?: string | null;
  archiveItemsCount?: number | null;
  archiveUncompressedBytes?: number | null;
  archiveEntries?: ArchiveEntryInfo[] | null;
  epubAuthor?: string | null;
  epubDescription?: string | null;
  epubCoverDataUrl?: string | null;
  epubChapters?: string[] | null;
  exifCamera?: string | null;
  exifLens?: string | null;
  exifIso?: string | null;
  exifAperture?: string | null;
  exifShutter?: string | null;
  exifFocalLength?: string | null;
  exifDateTaken?: string | null;
  selectionIndex?: number | null;
  selectionTotal?: number | null;
  extension: string;
  modifiedDate?: string | null;
}

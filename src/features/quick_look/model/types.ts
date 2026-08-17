export type QuickLookMediaType =
  | "audio"
  | "video"
  | "image"
  | "pdf"
  | "text"
  | "markdown"
  | "folder"
  | "project"
  | "generic";

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
  extension: string;
  modifiedDate?: string | null;
}

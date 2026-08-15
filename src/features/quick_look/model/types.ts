export type QuickLookMediaType = "audio" | "video" | "image";

export interface QuickLookPayload {
  path: string;
  fileName: string;
  mediaType: QuickLookMediaType;
  fileSizeBytes: number;
  formattedSize: string;
  trackTitle?: string | null;
  trackArtist?: string | null;
  durationSeconds?: number | null;
}

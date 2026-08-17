export type ConversionMode =
  | "image"
  | "video_to_audio"
  | "video_transcode"
  | "audio_transcode";

export interface FFmpegStatus {
  is_available: boolean;
  ffmpeg_path: string | null;
  ffprobe_path: string | null;
  version: string | null;
}

export interface ImageConvertOptions {
  target_format: string; // "jpg" | "png" | "webp" | "avif" | "bmp" | "tiff" | "gif"
  quality?: number; // 1 - 100
  resize_width?: number;
  resize_height?: number;
  keep_aspect_ratio?: boolean;
  strip_metadata?: boolean;
}

export interface VideoToAudioOptions {
  target_format: string; // "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a"
  bitrate?: string; // "128k" | "192k" | "256k" | "320k"
  sample_rate?: number;
  channels?: number;
}

export interface VideoTranscodeOptions {
  target_format: string; // "mp4" | "mkv" | "webm"
  video_codec: string; // "h264" | "hevc" | "av1" | "vp9" | "copy"
  crf?: number;
  preset?: string; // "ultrafast" | "fast" | "medium" | "slow"
  scale?: string; // "1920:1080" | "1280:720" | "854:480" | "none"
  audio_codec?: string; // "aac" | "mp3" | "opus" | "copy"
  audio_bitrate?: string;
}

export interface AudioTranscodeOptions {
  target_format: string; // "mp3" | "flac" | "wav" | "ogg" | "aac" | "m4a"
  bitrate?: string;
  sample_rate?: number;
  channels?: number;
}

export type JobStatus = "pending" | "processing" | "completed" | "error";

export interface ConversionQueueItem {
  id: string;
  inputPath: string;
  fileName: string;
  fileSizeBytes: number;
  targetFormat: string;
  outputPath: string;
  status: JobStatus;
  errorMessage?: string;
  progressPercent?: number;
}

export interface BatchRenameRules {
  enabled: boolean;
  prefix: string;
  suffix: string;
  findText: string;
  replaceText: string;
  numberingStart: number;
  numberingDigits: number;
}

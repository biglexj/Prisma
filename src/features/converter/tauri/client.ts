import { invoke } from "@tauri-apps/api/core";
import type {
  AudioTranscodeOptions,
  FFmpegStatus,
  ImageConvertOptions,
  VideoToAudioOptions,
  VideoTranscodeOptions,
} from "../model/types";

export interface BatchJobPayload {
  mode: "image" | "video_to_audio" | "video_transcode" | "audio_transcode";
  input_path: string;
  output_path: string;
  options:
    | ImageConvertOptions
    | VideoToAudioOptions
    | VideoTranscodeOptions
    | AudioTranscodeOptions;
}

export interface BatchJobResult {
  input_path: string;
  output_path: string;
  success: boolean;
  error: string | null;
}

export const converterClient = {
  getStatus: () => invoke<FFmpegStatus>("converter_get_status"),

  convertImage: (input_path: string, output_path: string, options: ImageConvertOptions) =>
    invoke<void>("converter_convert_image", { inputPath: input_path, outputPath: output_path, options }),

  extractVideoAudio: (input_path: string, output_path: string, options: VideoToAudioOptions) =>
    invoke<void>("converter_extract_video_audio", { inputPath: input_path, outputPath: output_path, options }),

  transcodeVideo: (input_path: string, output_path: string, options: VideoTranscodeOptions) =>
    invoke<void>("converter_transcode_video", { inputPath: input_path, outputPath: output_path, options }),

  transcodeAudio: (input_path: string, output_path: string, options: AudioTranscodeOptions) =>
    invoke<void>("converter_transcode_audio", { inputPath: input_path, outputPath: output_path, options }),

  processBatchItem: (job: BatchJobPayload) =>
    invoke<BatchJobResult>("converter_process_batch_item", { job }),

  scanFolder: (folder_path: string, mode: string) =>
    invoke<string[]>("converter_scan_folder", { folderPath: folder_path, mode }),
};

import { invoke } from "@tauri-apps/api/core";
import type { AudioTagData, ImageExifData, UpdateAudioTagsRequest } from "../model/types";

export const tagsClient = {
  readAudioTags: (path: string, includeArtwork = true) =>
    invoke<AudioTagData>("audio_read_tags", { path, includeArtwork }),

  writeAudioTags: (request: UpdateAudioTagsRequest) =>
    invoke<void>("audio_write_tags", { request }),

  batchWriteAudioTags: (requests: UpdateAudioTagsRequest[]) =>
    invoke<string[]>("audio_batch_write_tags", { requests }),

  saveLyrics: (
    path: string,
    lyrics: string,
    srtContent?: string | null,
    saveLrcFile = true,
    saveSrtFile = false,
    embedInTag = false
  ) =>
    invoke<void>("audio_save_lyrics", {
      path,
      lyrics,
      srtContent: srtContent || null,
      saveLrcFile,
      saveSrtFile,
      embedInTag,
    }),

  readImageExif: (path: string) =>
    invoke<ImageExifData>("image_read_exif", { path }),
};

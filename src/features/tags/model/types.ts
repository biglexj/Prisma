export interface AudioTagData {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  track_total: number | null;
  disc_number: number | null;
  disc_total: number | null;
  comment: string | null;
  lyrics: string | null;
  duration_seconds: number | null;
  bitrate_kbps: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  format_name: string | null;
  has_artwork: boolean;
  artwork_mime: string | null;
  artwork_data_url: string | null;
}

export interface UpdateAudioTagsRequest {
  path: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  year?: number | null;
  genre?: string | null;
  track_number?: number | null;
  track_total?: number | null;
  disc_number?: number | null;
  disc_total?: number | null;
  comment?: string | null;
  lyrics?: string | null;
  artwork_base64?: string | null;
}

export interface ImageExifData {
  path: string;
  file_name: string;
  file_size_bytes: number;
  format: string;
  width: number;
  height: number;
  aspect_ratio: string;
  megapixels: number;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  date_taken: string | null;
  iso: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  focal_length: string | null;
  exposure_bias: string | null;
  flash: string | null;
  white_balance: string | null;
  software: string | null;
  color_space: string | null;
  latitude: number | null;
  longitude: number | null;
}

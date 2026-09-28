#[cfg(windows)]
pub mod windows_impl {
    use std::path::Path;
    use std::sync::{Arc, Mutex};
    use tauri::{AppHandle, Emitter};
    use windows::core::{factory, HSTRING};
    use windows::Foundation::{TimeSpan, TypedEventHandler};
    use windows::Media::{
        MediaPlaybackStatus, MediaPlaybackType, SystemMediaTransportControls,
        SystemMediaTransportControlsButton,
        SystemMediaTransportControlsButtonPressedEventArgs,
        SystemMediaTransportControlsTimelineProperties,
    };
    use windows::Storage::StorageFile;
    use windows::Storage::Streams::RandomAccessStreamReference;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::ISystemMediaTransportControlsInterop;

    const FALLBACK_ICON_BYTES: &[u8] = include_bytes!("../../../icons/icon.png");

    pub struct NativeSmtcManager {
        controls: SystemMediaTransportControls,
        _app_handle: AppHandle,
        art_slot: std::sync::atomic::AtomicUsize,
    }

    impl NativeSmtcManager {
        pub fn new(hwnd: HWND, app_handle: AppHandle) -> Result<Arc<Mutex<Self>>, String> {
            let interop: ISystemMediaTransportControlsInterop = factory::<
                SystemMediaTransportControls,
                ISystemMediaTransportControlsInterop,
            >()
            .map_err(|e| format!("Error obteniendo factory SMTC: {e}"))?;

            let controls: SystemMediaTransportControls = unsafe {
                interop
                    .GetForWindow(hwnd)
                    .map_err(|e| format!("Error en GetForWindow: {e}"))?
            };

            let _ = controls.SetIsEnabled(true);
            let _ = controls.SetIsPlayEnabled(true);
            let _ = controls.SetIsPauseEnabled(true);
            let _ = controls.SetIsStopEnabled(true);
            let _ = controls.SetIsNextEnabled(true);
            let _ = controls.SetIsPreviousEnabled(true);

            if let Ok(updater) = controls.DisplayUpdater() {
                let _ = updater.SetType(MediaPlaybackType::Music);
                let _ = updater.Update();
            }

            let handle_clone = app_handle.clone();
            let button_handler = TypedEventHandler::new(
                move |_sender,
                      args: &Option<SystemMediaTransportControlsButtonPressedEventArgs>| {
                    if let Some(args_ref) = args {
                        if let Ok(button) = args_ref.Button() {
                            let action = match button {
                                SystemMediaTransportControlsButton::Play => "play",
                                SystemMediaTransportControlsButton::Pause => "pause",
                                SystemMediaTransportControlsButton::Stop => "pause",
                                SystemMediaTransportControlsButton::Next => "next",
                                SystemMediaTransportControlsButton::Previous => "previous",
                                _ => "",
                            };
                            if !action.is_empty() {
                                let _ = handle_clone.emit("prisma://smtc-action", action);
                            }
                        }
                    }
                    Ok(())
                },
            );

            let _ = controls.ButtonPressed(&button_handler);

            Ok(Arc::new(Mutex::new(Self {
                controls,
                _app_handle: app_handle,
                art_slot: std::sync::atomic::AtomicUsize::new(0),
            })))
        }

        pub fn set_playback_status(&self, is_playing: bool) {
            let _ = self.controls.SetIsEnabled(true);
            let status = if is_playing {
                MediaPlaybackStatus::Playing
            } else {
                MediaPlaybackStatus::Paused
            };
            let _ = self.controls.SetPlaybackStatus(status);
        }

        pub fn update_metadata(
            &self,
            title: &str,
            artist: &str,
            album: &str,
            source_path: Option<&str>,
            media_type: Option<&str>,
        ) {
            let Ok(updater) = self.controls.DisplayUpdater() else {
                return;
            };

            let _ = self.controls.SetIsEnabled(true);
            let _ = self.controls.SetIsPlayEnabled(true);
            let _ = self.controls.SetIsPauseEnabled(true);
            let _ = self.controls.SetIsStopEnabled(true);
            let _ = self.controls.SetIsNextEnabled(true);
            let _ = self.controls.SetIsPreviousEnabled(true);

            let is_video = media_type == Some("video");
            let _ = updater.SetType(if is_video {
                MediaPlaybackType::Video
            } else {
                MediaPlaybackType::Music
            });

            if is_video {
                if let Ok(video) = updater.VideoProperties() {
                    let _ = video.SetTitle(&HSTRING::from(title));
                    let _ = video.SetSubtitle(&HSTRING::from(artist));
                }
            } else {
                if let Ok(music) = updater.MusicProperties() {
                    let _ = music.SetTitle(&HSTRING::from(title));
                    let _ = music.SetArtist(&HSTRING::from(artist));
                    let _ = music.SetAlbumTitle(&HSTRING::from(album));
                }
            }

            // Manejo de la miniatura/carátula nativa para el flyout de volumen
            let mut thumbnail_bytes: Option<Vec<u8>> = None;
            let mut is_png_format = false;

            if let Some(path_str) = source_path {
                let media_path = Path::new(path_str);
                if is_video {
                    if let Some(raw_bytes) =
                        crate::infrastructure::media_preview::load_video_thumbnail_raw_bytes(media_path)
                    {
                        thumbnail_bytes = Some(raw_bytes);
                    }
                } else if let Some((raw_bytes, mime)) =
                    crate::infrastructure::artwork::load_music_artwork_raw_bytes(media_path)
                {
                    is_png_format = mime.contains("png");
                    thumbnail_bytes = Some(raw_bytes);
                }
            }

            let (bytes_to_write, ext) = if let Some(bytes) = thumbnail_bytes.as_deref() {
                (bytes, if is_png_format { "png" } else { "jpg" })
            } else {
                (FALLBACK_ICON_BYTES, "png")
            };

            let slot = self.art_slot.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % 4;
            let temp_art_path = std::env::temp_dir().join(format!("prisma_smtc_art_{slot}.{ext}"));

            if std::fs::write(&temp_art_path, bytes_to_write).is_ok() {
                let path_hstring = HSTRING::from(temp_art_path.to_string_lossy().to_string());
                if let Ok(async_op) = StorageFile::GetFileFromPathAsync(&path_hstring) {
                    if let Ok(storage_file) = async_op.get() {
                        if let Ok(stream) =
                            RandomAccessStreamReference::CreateFromFile(&storage_file)
                        {
                            let _ = updater.SetThumbnail(&stream);
                        }
                    }
                }
            }

            let _ = updater.Update();
        }

        pub fn update_timeline(&self, position_secs: f64, duration_secs: f64) {
            if duration_secs <= 0.0 {
                return;
            }
            if let Ok(timeline) = SystemMediaTransportControlsTimelineProperties::new() {
                let pos_ticks = (position_secs.max(0.0) * 10_000_000.0) as i64;
                let dur_ticks = (duration_secs.max(0.0) * 10_000_000.0) as i64;

                let _ = timeline.SetStartTime(TimeSpan::default());
                let _ = timeline.SetMinSeekTime(TimeSpan::default());
                let _ = timeline.SetPosition(TimeSpan { Duration: pos_ticks });
                let _ = timeline.SetEndTime(TimeSpan { Duration: dur_ticks });
                let _ = timeline.SetMaxSeekTime(TimeSpan { Duration: dur_ticks });

                let _ = self.controls.UpdateTimelineProperties(&timeline);
            }
        }

        pub fn clear(&self) {
            let _ = self.controls.SetPlaybackStatus(MediaPlaybackStatus::Closed);
            let _ = self.controls.SetIsEnabled(false);
            if let Ok(updater) = self.controls.DisplayUpdater() {
                let _ = updater.ClearAll();
                let _ = updater.Update();
            }
        }
    }
}

#[cfg(not(windows))]
pub mod dummy_impl {
    use std::sync::{Arc, Mutex};
    use tauri::AppHandle;

    pub struct NativeSmtcManager;

    impl NativeSmtcManager {
        pub fn new(_app_handle: AppHandle) -> Result<Arc<Mutex<Self>>, String> {
            Ok(Arc::new(Mutex::new(Self)))
        }
        pub fn set_playback_status(&self, _is_playing: bool) {}
        pub fn update_metadata(
            &self,
            _title: &str,
            _artist: &str,
            _album: &str,
            _source_path: Option<&str>,
            _media_type: Option<&str>,
        ) {
        }
        pub fn update_timeline(&self, _position_secs: f64, _duration_secs: f64) {}
        pub fn clear(&self) {}
    }
}

#[cfg(windows)]
pub use windows_impl::NativeSmtcManager;

#[cfg(not(windows))]
pub use dummy_impl::NativeSmtcManager;

pub type NativeSmtcState = std::sync::Arc<std::sync::Mutex<Option<std::sync::Arc<std::sync::Mutex<NativeSmtcManager>>>>>;

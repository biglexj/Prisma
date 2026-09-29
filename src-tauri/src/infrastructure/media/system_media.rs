//! Metadata, transport and activation refer to the same Windows media session.
use serde::Serialize;

pub enum AppActivation {
    Window { handle: isize, process_id: u32 },
    Registered(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMedia {
    is_playing: bool,
    title: String,
    artist: String,
    artwork_url: Option<String>,
    media_type: &'static str,
    source_app_id: String,
    app_name: Option<String>,
    app_icon_url: Option<String>,
    can_toggle: bool,
    can_next: bool,
    can_previous: bool,
}

#[cfg(windows)]
mod platform {
    use super::{AppActivation, SystemMedia};
    use base64::{Engine, engine::general_purpose::STANDARD};
    use windows::{
        ApplicationModel::AppInfo,
        Foundation::Size,
        Media::{
            Control::{
                GlobalSystemMediaTransportControlsSession as Session,
                GlobalSystemMediaTransportControlsSessionManager as SessionManager,
                GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
            },
            MediaPlaybackType,
        },
        Storage::Streams::{DataReader, IRandomAccessStreamWithContentType},
        Win32::{
            Foundation::{BOOL, CloseHandle, HWND, LPARAM},
            System::{
                Threading::{
                    AttachThreadInput, GetCurrentThreadId, OpenProcess, PROCESS_NAME_WIN32,
                    PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
                },
                WinRT::{RO_INIT_MULTITHREADED, RoInitialize, RoUninitialize},
            },
            UI::{
                Shell::ShellExecuteW,
                WindowsAndMessaging::{
                    BringWindowToTop, EnumWindows, GetForegroundWindow, GetWindowTextLengthW,
                    GetWindowThreadProcessId, IsIconic, IsWindowVisible, SW_RESTORE, SW_SHOWNORMAL,
                    SetForegroundWindow, ShowWindow,
                },
            },
        },
        core::{HSTRING, PCWSTR, PWSTR},
    };

    struct Apartment;
    impl Apartment {
        fn new() -> windows::core::Result<Self> {
            unsafe {
                RoInitialize(RO_INIT_MULTITHREADED)?;
            }
            Ok(Self)
        }
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                RoUninitialize();
            }
        }
    }

    fn is_prisma(id: &str) -> bool {
        matches!(
            id.to_ascii_lowercase().as_str(),
            "com.biglexj.prisma" | "prisma.exe" | "prisma"
        )
    }

    // Known desktop identities supplement AppInfo, which can reject unpackaged apps.
    fn desktop_identity(id: &str) -> Option<(&'static str, &'static str)> {
        match id.to_ascii_lowercase().as_str() {
            "vlc.exe" | "videolan.vlc" => Some(("VLC", "vlc.exe")),
            "chrome.exe" | "google.chrome" => Some(("Google Chrome", "chrome.exe")),
            "msedge.exe" | "microsoft.msedge" => Some(("Microsoft Edge", "msedge.exe")),
            "firefox.exe" | "mozilla.firefox" => Some(("Firefox", "firefox.exe")),
            "spotify.exe" | "spotify" => Some(("Spotify", "spotify.exe")),
            _ => None,
        }
    }

    fn image_data(
        stream: IRandomAccessStreamWithContentType,
    ) -> windows::core::Result<Option<String>> {
        let size = stream.Size()?;
        if size == 0 || size > 512 * 1024 {
            return Ok(None);
        }
        let content_type = stream.ContentType()?.to_string();
        let mime = match content_type.as_str() {
            "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/bmp" => content_type,
            _ => return Ok(None),
        };
        let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0)?)?;
        let loaded = reader.LoadAsync(size as u32)?.get()?;
        if loaded as u64 != size {
            return Ok(None);
        }
        let mut bytes = vec![0; loaded as usize];
        reader.ReadBytes(&mut bytes)?;
        Ok(Some(format!(
            "data:{mime};base64,{}",
            STANDARD.encode(bytes)
        )))
    }

    fn find_session(
        manager: &SessionManager,
        source: &str,
    ) -> windows::core::Result<Option<Session>> {
        let sessions = manager.GetSessions()?;
        for index in 0..sessions.Size()? {
            let session = sessions.GetAt(index)?;
            if session.SourceAppUserModelId()?.to_string() == source {
                return Ok(Some(session));
            }
        }
        Ok(None)
    }

    pub fn read() -> Result<Option<SystemMedia>, String> {
        let operation = || -> windows::core::Result<Option<SystemMedia>> {
            let _apartment = Apartment::new()?;
            let manager = SessionManager::RequestAsync()?.get()?;
            let session = match manager.GetCurrentSession() {
                Ok(session) => session,
                Err(_) => return Ok(None),
            };
            let source = session.SourceAppUserModelId()?.to_string();
            if is_prisma(&source) {
                return Ok(None);
            }
            let playback = session.GetPlaybackInfo()?;
            if playback.PlaybackStatus()? != Status::Playing {
                return Ok(None);
            }
            let metadata = session.TryGetMediaPropertiesAsync()?.get()?;
            let title = metadata.Title()?.to_string();
            if title.trim().is_empty() {
                return Ok(None);
            }
            let info = AppInfo::GetFromAppUserModelId(&HSTRING::from(&source)).ok();
            let display = info.as_ref().and_then(|info| info.DisplayInfo().ok());
            let app_name = display
                .as_ref()
                .and_then(|display| display.DisplayName().ok())
                .map(|name| name.to_string())
                .filter(|name| !name.trim().is_empty())
                .or_else(|| desktop_identity(&source).map(|identity| identity.0.to_owned()));
            let app_icon_url = display
                .and_then(|display| {
                    display
                        .GetLogo(Size {
                            Width: 24.0,
                            Height: 24.0,
                        })
                        .ok()
                })
                .and_then(|logo| logo.OpenReadAsync().ok()?.get().ok())
                .and_then(|stream| image_data(stream).ok().flatten());
            let artwork_url = metadata
                .Thumbnail()
                .ok()
                .and_then(|thumbnail| thumbnail.OpenReadAsync().ok()?.get().ok())
                .and_then(|stream| image_data(stream).ok().flatten());
            let controls = playback.Controls()?;
            let media_type = if playback.PlaybackType().and_then(|kind| kind.Value()).ok()
                == Some(MediaPlaybackType::Video)
            {
                "video"
            } else {
                "audio"
            };
            Ok(Some(SystemMedia {
                is_playing: true,
                title,
                artist: metadata.Artist()?.to_string(),
                artwork_url,
                media_type,
                source_app_id: source,
                app_name,
                app_icon_url,
                can_toggle: controls.IsPlayPauseToggleEnabled().unwrap_or(false)
                    || controls.IsPauseEnabled().unwrap_or(false),
                can_next: controls.IsNextEnabled().unwrap_or(false),
                can_previous: controls.IsPreviousEnabled().unwrap_or(false),
            }))
        };
        operation().map_err(|error| error.to_string())
    }

    pub fn transport(source: &str, action: &str) -> Result<(), String> {
        let operation = || -> windows::core::Result<bool> {
            let _apartment = Apartment::new()?;
            let manager = SessionManager::RequestAsync()?.get()?;
            let session = find_session(&manager, source)?.ok_or_else(|| {
                windows::core::Error::new(
                    windows::core::HRESULT(0x80070490u32 as i32),
                    "La sesión multimedia ya no está disponible",
                )
            })?;
            match action {
                "play-pause" => {
                    let playback = session.GetPlaybackInfo()?;
                    if playback
                        .Controls()?
                        .IsPlayPauseToggleEnabled()
                        .unwrap_or(false)
                    {
                        session.TryTogglePlayPauseAsync()?.get()
                    } else if playback.PlaybackStatus()? == Status::Playing {
                        session.TryPauseAsync()?.get()
                    } else {
                        session.TryPlayAsync()?.get()
                    }
                }
                "next" => session.TrySkipNextAsync()?.get(),
                "previous" => session.TrySkipPreviousAsync()?.get(),
                _ => Ok(false),
            }
        };
        if operation().map_err(|error| error.to_string())? {
            Ok(())
        } else {
            Err("La sesión multimedia no aceptó la acción".into())
        }
    }

    struct WindowSearch {
        executable: String,
        found: Option<HWND>,
    }
    unsafe extern "system" fn find_window(hwnd: HWND, param: LPARAM) -> BOOL {
        // EnumWindows is synchronous; the borrowed search outlives every callback.
        unsafe {
            let search = &mut *(param.0 as *mut WindowSearch);
            if !IsWindowVisible(hwnd).as_bool() || GetWindowTextLengthW(hwnd) == 0 {
                return BOOL(1);
            }
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut path = vec![0u16; 32768];
                let mut length = path.len() as u32;
                let result = QueryFullProcessImageNameW(
                    process,
                    PROCESS_NAME_WIN32,
                    PWSTR(path.as_mut_ptr()),
                    &mut length,
                );
                let _ = CloseHandle(process);
                if result.is_ok() {
                    let path = String::from_utf16_lossy(&path[..length as usize]);
                    if path
                        .rsplit('\\')
                        .next()
                        .is_some_and(|name| name.eq_ignore_ascii_case(&search.executable))
                    {
                        search.found = Some(hwnd);
                        return BOOL(0);
                    }
                }
            }
            BOOL(1)
        }
    }

    /// Only advertised media identities are accepted; no arbitrary executable paths.
    pub fn resolve_app(source: &str) -> Option<AppActivation> {
        let operation = || -> windows::core::Result<Option<AppActivation>> {
            let _apartment = Apartment::new()?;
            let manager = SessionManager::RequestAsync()?.get()?;
            if find_session(&manager, source)?.is_none() || is_prisma(source) {
                return Ok(None);
            }
            let executable = desktop_identity(source)
                .map(|identity| identity.1.to_owned())
                .or_else(|| {
                    // A simple executable identifier can be matched to a running window.
                    if source.to_ascii_lowercase().ends_with(".exe")
                        && !source.contains(['\\', '/', ':'])
                    {
                        Some(source.to_owned())
                    } else {
                        None
                    }
                });
            if let Some(executable) = executable {
                let mut search = WindowSearch {
                    executable,
                    found: None,
                };
                unsafe {
                    let _ = EnumWindows(Some(find_window), LPARAM(&mut search as *mut _ as isize));
                    if let Some(hwnd) = search.found {
                        let mut process_id = 0;
                        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
                        return Ok(Some(AppActivation::Window {
                            handle: hwnd.0 as isize,
                            process_id,
                        }));
                    }
                }
            }
            // Registered app IDs can be activated through AppsFolder, including packaged apps.
            if AppInfo::GetFromAppUserModelId(&HSTRING::from(source)).is_err() {
                return Ok(None);
            }
            Ok(Some(AppActivation::Registered(source.to_owned())))
        };
        operation().ok().flatten()
    }

    /// Called on the UI thread, which has the input queue needed for window focus.
    pub fn activate_app(target: AppActivation) -> bool {
        if let AppActivation::Window { handle, process_id } = target {
            unsafe {
                let hwnd = HWND(handle as *mut _);
                let mut current_pid = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut current_pid));
                if current_pid != process_id || current_pid == 0 {
                    return false;
                }
                let current = GetCurrentThreadId();
                let foreground = GetWindowThreadProcessId(GetForegroundWindow(), None);
                let attached = foreground != 0
                    && foreground != current
                    && AttachThreadInput(current, foreground, true).as_bool();
                if IsIconic(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }
                let focused = SetForegroundWindow(hwnd).as_bool();
                let _ = BringWindowToTop(hwnd);
                if attached {
                    let _ = AttachThreadInput(current, foreground, false);
                }
                return focused;
            }
        }
        if let AppActivation::Registered(source) = target {
            let target: Vec<u16> = format!("shell:AppsFolder\\{source}")
                .encode_utf16()
                .chain(Some(0))
                .collect();
            let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
            let result = unsafe {
                ShellExecuteW(
                    None,
                    PCWSTR(verb.as_ptr()),
                    PCWSTR(target.as_ptr()),
                    None,
                    None,
                    SW_SHOWNORMAL,
                )
            };
            return result.0 as isize > 32;
        }
        false
    }
}

#[cfg(windows)]
pub use platform::{activate_app, read, resolve_app, transport};

#[cfg(not(windows))]
pub fn read() -> Result<Option<SystemMedia>, String> {
    Ok(None)
}
#[cfg(not(windows))]
pub fn transport(_source: &str, _action: &str) -> Result<(), String> {
    Err("No disponible".into())
}
#[cfg(not(windows))]
pub fn resolve_app(_source: &str) -> Option<AppActivation> {
    None
}
#[cfg(not(windows))]
pub fn activate_app(_target: AppActivation) -> bool {
    false
}

use serde::Serialize;
use std::path::PathBuf;

/// Raíz del ecosistema biglexj en este equipo (carpetas de desarrollo).
const DEFAULT_ECOSYSTEM_ROOT: &str = r"D:\Proyectos\biglexj";

/// Estado local de una aplicación del ecosistema.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EcosystemAppState {
    /// Identificador estable usado por la interfaz.
    pub id: String,
    /// El ejecutable está instalado en el equipo.
    pub installed: bool,
    /// Ruta del ejecutable encontrado.
    pub path: Option<String>,
    /// El código fuente está presente en la raíz del ecosistema.
    pub has_source: bool,
    /// Ruta de la carpeta con el código fuente.
    pub source_path: Option<String>,
}

/// Definición de una app de escritorio: dónde se instala y dónde vive su código.
struct EcosystemAppEntry {
    id: &'static str,
    /// Carpetas candidatas de instalación (en %LOCALAPPDATA%\Programs y %ProgramFiles%).
    install_dirs: &'static [&'static str],
    /// Ejecutables candidatos dentro de esas carpetas.
    exes: &'static [&'static str],
    /// Carpeta del repositorio dentro de la raíz del ecosistema.
    source_dir: Option<&'static str>,
}

const ECOSYSTEM_APPS: &[EcosystemAppEntry] = &[
    EcosystemAppEntry {
        id: "aurora-synapse",
        install_dirs: &["Aurora Synapse", "AuroraSynapse"],
        exes: &["aurora-synapse.exe", "AuroraSynapse.exe"],
        source_dir: Some("Aurora-Synapse"),
    },
    EcosystemAppEntry {
        id: "ely-intelligence",
        install_dirs: &["Ely Intelligence", "ElyIntelligence"],
        exes: &["ely-intelligence.exe", "ElyIntelligence.exe"],
        source_dir: None,
    },
    EcosystemAppEntry {
        id: "davinci-flow",
        install_dirs: &["DaVinciFlow", "DaVinci Flow"],
        exes: &["DaVinciFlow.exe", "davinci-flow.exe"],
        source_dir: Some("DaVinciFlow"),
    },
    EcosystemAppEntry {
        id: "davinci-exportador",
        install_dirs: &["DaVinciExportador", "DaVinci Exportador"],
        exes: &["DaVinciExportador.exe", "DaVinci Exportador.exe"],
        source_dir: Some("DaVinci-Exportador"),
    },
    EcosystemAppEntry {
        id: "luna-fetch",
        install_dirs: &["LunaFetch", "Luna Fetch"],
        exes: &["LunaFetch.exe"],
        source_dir: Some("Luna---Fetch"),
    },
    EcosystemAppEntry {
        id: "gallery-dl-gui",
        install_dirs: &["GalleryDL-GUI", "Gallery-DL GUI"],
        exes: &["GalleryDL-GUI.exe"],
        source_dir: Some("Gallery-DL-GUI"),
    },
    EcosystemAppEntry {
        id: "prisma-upscaler",
        install_dirs: &["PrismaUpscalerCLI", "PrismaUpscaler", "prisma-upscaler"],
        exes: &["prisma-upscaler-cli.exe", "prisma-upscaler.exe", "prisma-upscaler-desktop.exe"],
        source_dir: Some("Prisma-Upscaler"),
    },
    EcosystemAppEntry {
        id: "lyraflow",
        install_dirs: &["LyraFlow"],
        exes: &["LyraFlow.exe"],
        source_dir: Some("LyraFlow"),
    },
    EcosystemAppEntry {
        id: "ely-tesia",
        install_dirs: &["Ely-Tesia", "ElyTesia"],
        exes: &["ElyTesia.exe", "Ely-Tesia.exe"],
        source_dir: Some("Ely-Tesia"),
    },
    EcosystemAppEntry {
        id: "wintts",
        install_dirs: &["WinTTS"],
        exes: &["wintts.exe", "WinTTS.exe"],
        source_dir: Some("WinTTS"),
    },
    EcosystemAppEntry {
        id: "mouziflow",
        install_dirs: &["MouziFlow"],
        exes: &["mouzi.exe", "MouziFlow.exe"],
        source_dir: Some("MouziFlow"),
    },
    EcosystemAppEntry {
        id: "nubix",
        // "NubeSync" es el nombre anterior a la marca Nubix: se sigue
        // detectando para reconocer instalaciones previas al renombrado.
        install_dirs: &["Nubix", "NubeSync"],
        exes: &["nubix.exe", "nube-sync.exe", "Nubix.exe", "NubeSync.exe"],
        source_dir: Some("Nubix"),
    },
];

fn ecosystem_root() -> PathBuf {
    std::env::var("PRISMA_ECOSYSTEM_ROOT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(DEFAULT_ECOSYSTEM_ROOT))
}

fn install_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&local_app_data).join("Programs"));
        roots.push(PathBuf::from(local_app_data));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(&program_files));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program_files_x86));
    }
    roots
}

fn find_installed_executable(app: &EcosystemAppEntry) -> Option<PathBuf> {
    for root in install_roots() {
        for dir in app.install_dirs {
            for exe in app.exes {
                let candidate = root.join(dir).join(exe);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

fn find_source_folder(app: &EcosystemAppEntry) -> Option<PathBuf> {
    let source_dir = app.source_dir?;
    let candidate = ecosystem_root().join(source_dir);
    if candidate.is_dir() {
        Some(candidate)
    } else {
        None
    }
}

fn state_for(app: &EcosystemAppEntry) -> EcosystemAppState {
    let installed_path = find_installed_executable(app);
    let source_path = find_source_folder(app);
    EcosystemAppState {
        id: app.id.to_string(),
        installed: installed_path.is_some(),
        path: installed_path.map(|p| p.to_string_lossy().to_string()),
        has_source: source_path.is_some(),
        source_path: source_path.map(|p| p.to_string_lossy().to_string()),
    }
}

/// Devuelve el estado de instalación de todas las apps de escritorio del ecosistema.
#[tauri::command]
pub async fn ecosystem_apps_state() -> Result<Vec<EcosystemAppState>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        ECOSYSTEM_APPS.iter().map(state_for).collect::<Vec<_>>()
    })
    .await
    .map_err(|e| format!("Error al consultar el estado del ecosistema: {e}"))
}

/// Lanza una app del ecosistema ya instalada en este equipo.
#[tauri::command]
pub async fn ecosystem_app_launch(id: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let app = ECOSYSTEM_APPS.iter().find(|entry| entry.id == id.trim());
        let Some(app) = app else {
            return Ok(false);
        };
        let Some(executable) = find_installed_executable(app) else {
            return Ok(false);
        };

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            Command::new(&executable)
                .spawn()
                .map(|_| true)
                .map_err(|e| format!("No se pudo iniciar {}: {e}", executable.display()))
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = executable;
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar la aplicación: {e}"))?
}

/// Ruta de la raíz del ecosistema (para diagnóstico y apertura en el explorador).
#[tauri::command]
pub async fn ecosystem_root_path() -> Result<String, String> {
    let root = ecosystem_root();
    if root.is_dir() {
        Ok(root.to_string_lossy().to_string())
    } else {
        Err(format!(
            "No se encontró la raíz del ecosistema en {}",
            root.display()
        ))
    }
}

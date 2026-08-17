use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLibraryDefinition {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub extensions: Vec<String>,
    pub external_app_command: Option<String>,
    pub folder_paths: Vec<String>,
    #[serde(default)]
    pub excluded_folder_paths: Vec<String>,
    pub is_preset: bool,
    pub is_active: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLibraryItem {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub relative_folder: String,
    pub size_bytes: u64,
    pub modified_timestamp: u64,
    pub is_excluded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLibraryFolderSource {
    pub path: String,
    pub available: bool,
    pub count: usize,
}

pub fn get_default_presets() -> Vec<CustomLibraryDefinition> {
    vec![
        CustomLibraryDefinition {
            id: "documents".to_string(),
            label: "Documentos".to_string(),
            icon: "file-text".to_string(),
            extensions: vec![
                "pdf".to_string(),
                "txt".to_string(),
                "md".to_string(),
                "docx".to_string(),
                "xlsx".to_string(),
                "pptx".to_string(),
                "csv".to_string(),
                "json".to_string(),
            ],
            external_app_command: None,
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Documentos, informes, hojas de cálculo y notas Markdown.".to_string()),
        },
        CustomLibraryDefinition {
            id: "books".to_string(),
            label: "Libros".to_string(),
            icon: "book-open".to_string(),
            extensions: vec![
                "epub".to_string(),
                "pdf".to_string(),
                "cbz".to_string(),
                "cbr".to_string(),
                "mobi".to_string(),
                "md".to_string(),
            ],
            external_app_command: None,
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Colección de libros electrónicos, cómics digitales, documentos PDF y notas Markdown.".to_string()),
        },
        CustomLibraryDefinition {
            id: "krita".to_string(),
            label: "Krita".to_string(),
            icon: "palette".to_string(),
            extensions: vec!["kra".to_string(), "krz".to_string(), "ora".to_string()],
            external_app_command: Some("krita".to_string()),
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Ilustraciones, bocetos y lienzos en capas de Krita.".to_string()),
        },
        CustomLibraryDefinition {
            id: "affinity".to_string(),
            label: "Affinity".to_string(),
            icon: "layers".to_string(),
            extensions: vec![
                "af".to_string(),
                "afphoto".to_string(),
                "afdesign".to_string(),
                "afpub".to_string(),
                "aftemplate".to_string(),
            ],
            external_app_command: None,
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Documentos y proyectos de Affinity (.af, .afphoto, .afdesign, .afpub).".to_string()),
        },
        CustomLibraryDefinition {
            id: "davinci".to_string(),
            label: "DaVinci Resolve".to_string(),
            icon: "film".to_string(),
            extensions: vec!["drp".to_string(), "dra".to_string(), "drb".to_string()],
            external_app_command: None,
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Líneas de tiempo, proyectos y archivos de DaVinci Resolve.".to_string()),
        },
        CustomLibraryDefinition {
            id: "graphics".to_string(),
            label: "Gráficos & PSD".to_string(),
            icon: "image".to_string(),
            extensions: vec![
                "psd".to_string(),
                "psb".to_string(),
                "svg".to_string(),
                "ai".to_string(),
                "eps".to_string(),
                "blend".to_string(),
            ],
            external_app_command: None,
            folder_paths: Vec::new(),
            excluded_folder_paths: Vec::new(),
            is_preset: true,
            is_active: false,
            description: Some("Archivos Photoshop en capas, vectores SVG y modelos 3D.".to_string()),
        },
    ]
}

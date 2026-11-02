//! Official wallpaper catalog transport. Credentials stay in the native session.
use serde::Deserialize;
use tauri::{AppHandle, State};
use crate::infrastructure::auth::session::SessionManager;

#[derive(Default, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Visibility { #[default] General, All, Premium, Nsfw }

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogOptions {
    page: Option<u32>,
    limit: Option<u32>,
    ratio: Option<String>,
    category: Option<String>,
    sort: Option<String>,
    query: Option<String>,
    #[serde(default)]
    visibility: Visibility,
}

fn catalog_url(options: &CatalogOptions) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse("https://biglexj.com/api/v1/wallpapers").unwrap();
    let visibility = match options.visibility {
        Visibility::General => "general", Visibility::All => "all",
        Visibility::Premium => "premium", Visibility::Nsfw => "nsfw",
    };
    let mut query = url.query_pairs_mut();
    query.append_pair("page", &options.page.unwrap_or(1).max(1).to_string());
    query.append_pair("limit", &options.limit.unwrap_or(50).clamp(1, 100).to_string());
    query.append_pair("vis", visibility);
    if matches!(options.visibility, Visibility::All | Visibility::Nsfw) { query.append_pair("nsfw", "true"); }
    for (key, value) in [("ratio", &options.ratio), ("category", &options.category), ("sort", &options.sort), ("q", &options.query)] {
        if let Some(value) = value {
            if value.len() > 512 { return Err("El filtro del catálogo es demasiado largo.".into()); }
            query.append_pair(key, value);
        }
    }
    drop(query);
    Ok(url)
}

#[tauri::command]
pub async fn aurora_wallpapers_catalog(app: AppHandle, session: State<'_, SessionManager>, options: CatalogOptions) -> Result<serde_json::Value, String> {
    let url = catalog_url(&options)?;
    if session.access_token().is_none() && session.has_session() { session.refresh(&app).await?; }
    let token = session.access_token();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| "No se pudo preparar la conexión al catálogo.".to_string())?;
    let mut request = client.get(url).header("Accept", "application/json").header("Cache-Control", "no-cache");
    if let Some(token) = token { request = request.bearer_auth(token); }
    let mut response = request.send().await.map_err(|_| "No se pudo conectar al catálogo de Biglex J.".to_string())?;
    if !response.status().is_success() {
        return Err(format!("El catálogo respondió HTTP {}. Comprueba tu conexión o verifica tu sesión.", response.status().as_u16()));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "La respuesta del catálogo se interrumpió.".to_string())? {
        if bytes.len() + chunk.len() > 4 * 1024 * 1024 { return Err("La respuesta del catálogo excede el tamaño permitido.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "El catálogo devolvió una respuesta no válida.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_official_catalog_with_explicit_visibility_and_escaped_query() {
        let options: CatalogOptions = serde_json::from_value(serde_json::json!({"visibility":"all","query":"Ely & Biglex","ratio":"9:16","limit":500})).unwrap();
        let url = catalog_url(&options).unwrap();
        assert_eq!(url.origin().ascii_serialization(), "https://biglexj.com");
        assert_eq!(url.path(), "/api/v1/wallpapers");
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(query["vis"], "all"); assert_eq!(query["nsfw"], "true");
        assert_eq!(query["q"], "Ely & Biglex"); assert_eq!(query["limit"], "100");
        assert_eq!(query["ratio"], "9:16");
    }
    #[test]
    fn general_is_default_and_unknown_visibility_is_rejected() {
        let url = catalog_url(&CatalogOptions::default()).unwrap();
        assert!(url.query_pairs().any(|(k,v)| k == "vis" && v == "general"));
        assert!(!url.query_pairs().any(|(k,_)| k == "nsfw"));
        assert!(serde_json::from_value::<CatalogOptions>(serde_json::json!({"visibility":"admin"})).is_err());
    }
}

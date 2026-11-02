//! Comandos Tauri para la sesión de usuario y autenticación de Prisma.

use tauri::{AppHandle, State};

use crate::infrastructure::auth::deeplink;
use crate::infrastructure::auth::session::{SessionManager, SessionSnapshot};

#[tauri::command]
pub async fn auth_session_status(app: AppHandle, session: State<'_, SessionManager>) -> Result<SessionSnapshot, String> {
    let snapshot = session.snapshot();
    if !snapshot.verified && session.has_session() {
        return session.refresh(&app).await;
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn auth_session_login(
    app: AppHandle,
    session: State<'_, SessionManager>,
    provider: Option<String>,
) -> Result<String, String> {
    let prov = provider.unwrap_or_else(|| "google".to_string());
    session.begin_login(&app, &prov)
}

#[tauri::command]
pub async fn auth_session_complete(
    app: AppHandle,
    session: State<'_, SessionManager>,
    code: String,
) -> Result<SessionSnapshot, String> {
    session.complete_login(&app, &code).await
}

#[tauri::command]
pub async fn auth_session_refresh(
    app: AppHandle,
    session: State<'_, SessionManager>,
) -> Result<SessionSnapshot, String> {
    session.refresh(&app).await
}

#[tauri::command]
pub async fn auth_session_logout(
    app: AppHandle,
    session: State<'_, SessionManager>,
) -> Result<(), String> {
    session.logout(&app).await
}

#[tauri::command]
pub async fn auth_session_access_token(app: AppHandle, session: State<'_, SessionManager>) -> Result<Option<String>, String> {
    if session.access_token().is_none() && session.has_session() {
        session.refresh(&app).await?;
    }
    Ok(session.access_token())
}

/// Comprueba si hay una URL profunda pendiente consumida durante el arranque
/// o por single-instance y, de haber un código de autorización, completa la sesión.
#[tauri::command]
pub async fn auth_consume_pending_callback(
    app: AppHandle,
    session: State<'_, SessionManager>,
) -> Result<Option<SessionSnapshot>, String> {
    if let Some(url) = deeplink::take() {
        if let Some(code) = deeplink::query_param(&url, "code") {
            let snap = session.complete_login(&app, &code).await?;
            return Ok(Some(snap));
        }
        session.cancel_login(&app);
    }
    Ok(None)
}

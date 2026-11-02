//! Sesión de usuario de Prisma.
//!
//! El inicio de sesión sigue el estándar Core del ecosistema Biglex J para
//! aplicaciones nativas: navegador del sistema, autorización con PKCE y
//! callback con esquema URI propio (`prisma://auth/callback`), además de
//! soporte para vinculación por código de dispositivo (Device Code flow en
//! `biglexj.com/vincular`).
//!
//! El refresh token vive en la bóveda nativa cifrada (Windows Credential Manager / DPAPI)
//! y nunca viaja al renderer del WebView. El frontend solo recibe el estado de la sesión
//! y solicita el access token bajo demanda en memoria volátil.

use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use super::vault;
#[path = "provider_tokens.rs"]
mod provider_tokens;
use provider_tokens::provider_token_request;

const PENDING_TTL_SECS: u64 = 300;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const EXPIRY_MARGIN_SECS: u64 = 60;
#[allow(dead_code)]
const RENEW_AHEAD_SECS: u64 = 300;
#[allow(dead_code)]
const MAX_RESPONSE_BYTES: usize = 64 * 1024;
#[allow(dead_code)]
const RENEW_MUTEX_NAME: &str = r"Local\prisma-session-renew";

const SUPPORTED_PROVIDERS: [&str; 4] = ["google", "github", "discord", "biglexj"];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionState {
    Absent,
    Authenticating,
    Active,
    Renewing,
    Expired,
    Revoked,
    NetworkError,
    StorageError,
    NotConfigured,
}

impl SessionState {
    #[allow(dead_code)]
    pub fn is_verified(self) -> bool {
        matches!(self, SessionState::Active)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
    pub state: SessionState,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub provider: Option<String>,
    pub expires_at: Option<u64>,
    pub verified: bool,
    pub error: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthIssuer {
    Provider,
    Backend,
}

#[derive(Clone, Debug)]
pub struct SessionConfig {
    pub issuer: AuthIssuer,
    pub base_url: String,
    pub publishable_key: Option<String>,
    pub redirect_uri: String,
    pub client_id: String,
}

impl SessionConfig {
    pub fn resolve() -> Option<Self> {
        let issuer = resolve_issuer();
        let redirect_uri = std::env::var("PRISMA_AUTH_REDIRECT_URI")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| super::deeplink::callback_url());
        if !super::deeplink::is_callback_url(&redirect_uri) || redirect_uri.contains('?') { return None; }
        let client_id = std::env::var("PRISMA_AUTH_CLIENT_ID")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "prisma".to_string());

        match issuer {
            AuthIssuer::Backend => {
                let base = std::env::var("PRISMA_AUTH_BACKEND_URL")
                    .ok()
                    .filter(|val| !val.trim().is_empty())
                    .unwrap_or_else(|| "https://biglexj.com".to_string());
                Some(Self {
                    issuer,
                    base_url: base.trim_end_matches('/').to_string(),
                    publishable_key: None,
                    redirect_uri,
                    client_id,
                })
            }
            AuthIssuer::Provider => {
                let public: serde_json::Value = serde_json::from_str(include_str!("../../../auth.public.json")).ok()?;
                let supabase_url = std::env::var("PRISMA_SUPABASE_URL")
                    .or_else(|_| std::env::var("AURORA_SUPABASE_URL"))
                    .ok()
                    .map(|v| v.trim().to_string())
                    .filter(|v| !v.is_empty())
                    .or_else(|| public["supabaseUrl"].as_str().map(str::to_string))?;
                let publishable_key = std::env::var("PRISMA_SUPABASE_PUBLISHABLE_KEY")
                    .or_else(|_| std::env::var("AURORA_SUPABASE_PUBLISHABLE_KEY"))
                    .ok()
                    .map(|v| v.trim().to_string())
                    .filter(|v| !v.is_empty())
                    .or_else(|| public["publishableKey"].as_str().map(str::to_string));
                if !publishable_key.as_deref().is_some_and(|key| key.starts_with("sb_publishable_")) { return None; }
                if !supabase_url.starts_with("https://") { return None; }
                Some(Self {
                    issuer,
                    base_url: supabase_url.trim_end_matches('/').to_string(),
                    publishable_key,
                    redirect_uri,
                    client_id,
                })
            }
        }
    }

    fn auth_base(&self) -> String {
        match self.issuer {
            AuthIssuer::Provider => format!("{}/auth/v1", self.base_url),
            AuthIssuer::Backend => format!("{}/api/v1/auth", self.base_url),
        }
    }

    fn token_url(&self) -> String {
        format!("{}/token", self.auth_base())
    }

    fn logout_url(&self) -> String {
        match self.issuer {
            AuthIssuer::Provider => format!("{}/logout?scope=local", self.auth_base()),
            AuthIssuer::Backend => format!("{}/revoke", self.auth_base()),
        }
    }

    fn authorize_url(&self, provider: &str, challenge: &str) -> String {
        match self.issuer {
            AuthIssuer::Provider => {
                let redirect_to = std::env::var("PRISMA_AUTH_REDIRECT_TO")
                    .ok()
                    .filter(|val| !val.trim().is_empty())
                    .unwrap_or_else(|| {
                        format!(
                            "https://biglexj.com/auth/native-return?app={}",
                            super::deeplink::scheme()
                        )
                    });
                let mut query = vec![
                    ("provider", provider.to_string()),
                    ("redirect_to", redirect_to),
                    ("code_challenge", challenge.to_string()),
                    ("code_challenge_method", "S256".to_string()),
                ];
                query.sort_by(|left, right| left.0.cmp(&right.0));
                format!(
                    "{}?{}",
                    format!("{}/authorize", self.auth_base()),
                    query
                        .iter()
                        .map(|(key, value)| format!("{}={}", key, percent_encode(value)))
                        .collect::<Vec<String>>()
                        .join("&")
                )
            }
            AuthIssuer::Backend => {
                let query = vec![
                    ("client_id", self.client_id.clone()),
                    ("redirect_uri", self.redirect_uri.clone()),
                    ("code_challenge", challenge.to_string()),
                    ("code_challenge_method", "S256".to_string()),
                ];
                format!(
                    "{}?{}",
                    format!("{}/authorize", self.auth_base()),
                    query
                        .iter()
                        .map(|(key, value)| format!("{}={}", key, percent_encode(value)))
                        .collect::<Vec<String>>()
                        .join("&")
                )
            }
        }
    }
}

fn resolve_issuer() -> AuthIssuer {
    let configured = std::env::var("PRISMA_AUTH_MODE")
        .ok()
        .map(|value| value.trim().to_ascii_lowercase());
    match configured.as_deref() {
        Some("backend") => AuthIssuer::Backend,
        _ => AuthIssuer::Provider,
    }
}

fn environment_key() -> &'static str {
    if super::deeplink::scheme() == "prisma-dev" {
        "dev"
    } else {
        "prod"
    }
}

fn issuer_key() -> &'static str {
    match resolve_issuer() {
        AuthIssuer::Backend => "backend",
        AuthIssuer::Provider => "provider",
    }
}

fn session_target() -> String {
    format!("prisma:user-session:{}:{}", environment_key(), issuer_key())
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredTokens {
    access_token: String,
    refresh_token: String,
    expires_at: u64,
    user_id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    provider: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingFlow {
    verifier: String,
    created_at: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
    #[serde(default)]
    tokens: Option<StoredTokens>,
    #[serde(default)]
    pending: Option<PendingFlow>,
}

struct Inner {
    state: SessionState,
    user_id: Option<String>,
    email: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    provider: Option<String>,
    expires_at: Option<u64>,
    verified: bool,
    error: Option<String>,
    tokens: Option<StoredTokens>,
    pending: Option<PendingFlow>,
}

/// Dispositivo pendiente para flujo Device Code
#[allow(dead_code)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

pub struct SessionManager {
    inner: Mutex<Inner>,
    client: reqwest::Client,
}

impl SessionManager {
    pub fn restore(app: &AppHandle) -> Self {
        let mut inner = Inner {
            state: SessionState::Absent,
            user_id: None,
            email: None,
            display_name: None,
            avatar_url: None,
            provider: None,
            expires_at: None,
            verified: false,
            error: None,
            tokens: None,
            pending: None,
        };

        if SessionConfig::resolve().is_none() {
            inner.state = SessionState::NotConfigured;
        }

        match read_vault(app) {
            Ok(Some(document)) => {
                inner.pending = document.pending.filter(|flow| !flow_is_expired(flow));
                if let Some(tokens) = document.tokens {
                    let expired = tokens.expires_at <= now_epoch_secs();
                    inner.user_id = Some(tokens.user_id.clone());
                    inner.email = tokens.email.clone();
                    inner.display_name = tokens.display_name.clone();
                    inner.avatar_url = tokens.avatar_url.clone();
                    inner.provider = tokens.provider.clone();
                    inner.expires_at = Some(tokens.expires_at);
                    inner.state = if expired {
                        SessionState::Expired
                    } else {
                        SessionState::Active
                    };
                    inner.verified = false;
                    inner.tokens = Some(tokens);
                }
            }
            Ok(None) => {}
            Err(error) => {
                if inner.state != SessionState::NotConfigured {
                    inner.state = SessionState::StorageError;
                    inner.error = Some(error);
                }
            }
        }

        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_default();

        Self {
            inner: Mutex::new(inner),
            client,
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|error| error.into_inner())
    }

    pub fn snapshot(&self) -> SessionSnapshot {
        let inner = self.lock();
        SessionSnapshot {
            state: inner.state,
            user_id: inner.user_id.clone(),
            email: inner.email.clone(),
            display_name: inner.display_name.clone(),
            avatar_url: inner.avatar_url.clone(),
            provider: inner.provider.clone(),
            expires_at: inner.expires_at,
            verified: inner.verified,
            error: inner.error.clone(),
        }
    }

    pub fn access_token(&self) -> Option<String> {
        let inner = self.lock();
        if !inner.verified || inner.state != SessionState::Active { return None; }
        inner
            .tokens
            .as_ref()
            .filter(|tokens| tokens.expires_at > now_epoch_secs() + EXPIRY_MARGIN_SECS)
            .map(|tokens| tokens.access_token.clone())
    }

    #[allow(dead_code)]
    pub fn has_session(&self) -> bool {
        self.lock().tokens.is_some()
    }

    pub fn has_pending_login(&self) -> bool {
        self.lock().pending.as_ref().is_some_and(|flow| !flow_is_expired(flow))
    }

    pub fn cancel_login(&self, app: &AppHandle) {
        self.lock().pending = None;
        let _ = self.persist(app);
        self.fail(app, SessionState::Absent, "El inicio de sesión se canceló o no devolvió un código válido.");
    }

    pub fn begin_login(&self, app: &AppHandle, provider: &str) -> Result<String, String> {
        let provider = provider.trim().to_ascii_lowercase();
        if !SUPPORTED_PROVIDERS.contains(&provider.as_str()) {
            return Err("Proveedor de identidad no soportado en Prisma.".to_string());
        }
        let config = SessionConfig::resolve()
            .ok_or_else(|| "Prisma no tiene configurado el proveedor de identidad.".to_string())?;
        let verifier = new_code_verifier()?;
        let challenge = code_challenge(&verifier);
        let url = config.authorize_url(&provider, &challenge);

        {
            let mut inner = self.lock();
            inner.state = SessionState::Authenticating;
            inner.error = None;
            inner.provider = Some(provider);
            inner.pending = Some(PendingFlow {
                verifier,
                created_at: now_epoch_secs(),
            });
        }

        if let Err(message) = self.persist(app) {
            let mut inner = self.lock();
            inner.state = SessionState::Absent;
            inner.pending = None;
            inner.error = Some(message.clone());
            drop(inner);
            self.notify(app);
            return Err(message);
        }

        self.notify(app);
        Ok(url)
    }

    pub async fn complete_login(&self, app: &AppHandle, code: &str) -> Result<SessionSnapshot, String> {
        let code = code.trim();
        if code.is_empty() {
            return Err("El proveedor no devolvió un código de autorización.".to_string());
        }
        let config = SessionConfig::resolve()
            .ok_or_else(|| "Prisma no tiene configurado el proveedor de identidad.".to_string())?;
        let pending = {
            let inner = self.lock();
            inner.pending.clone()
        };
        let pending = pending
            .filter(|flow| !flow_is_expired(flow))
            .ok_or_else(|| "El inicio de sesión caducó antes de completarse. Vuelve a intentarlo.".to_string())?;

        {
            let mut inner = self.lock();
            inner.state = SessionState::Authenticating;
            inner.error = None;
        }

        let response = exchange_code(&self.client, &config, code, &pending.verifier).await;

        let tokens = match response {
            Ok(tokens) => tokens,
            Err(error) => {
                let message = error.message().to_string();
                self.fail(app, error.state(), &message);
                return Err(message);
            }
        };

        let _guard = RenewalGuard::acquire()?;

        {
            let mut inner = self.lock();
            inner.error = None;
            inner.user_id = Some(tokens.user_id.clone());
            inner.email = tokens.email.clone();
            inner.display_name = tokens.display_name.clone();
            inner.avatar_url = tokens.avatar_url.clone();
            inner.provider = tokens.provider.clone();
            inner.expires_at = Some(tokens.expires_at);
            inner.tokens = Some(tokens);
            inner.pending = None;
        }

        if let Err(message) = self.persist(app) {
            let mut inner = self.lock();
            inner.state = SessionState::StorageError;
            inner.tokens = None;
            inner.user_id = None;
            inner.email = None;
            inner.display_name = None;
            inner.avatar_url = None;
            inner.provider = None;
            inner.expires_at = None;
            inner.verified = false;
            inner.error = Some(message.clone());
            drop(inner);
            self.notify(app);
            return Err(message);
        }

        {
            let mut inner = self.lock();
            inner.state = SessionState::Active;
            inner.verified = true;
        }
        self.notify(app);
        Ok(self.snapshot())
    }

    pub async fn refresh(&self, app: &AppHandle) -> Result<SessionSnapshot, String> {
        let _guard = RenewalGuard::acquire()?;
        let config = SessionConfig::resolve()
            .ok_or_else(|| "Prisma no tiene configurado el proveedor de identidad.".to_string())?;

        let tokens = match self.choose_pair(app)? {
            Some(pair) => pair,
            None => {
                let message = "No hay sesión que renovar.".to_string();
                self.fail(app, SessionState::Absent, &message);
                return Err(message);
            }
        };

        {
            let mut inner = self.lock();
            inner.state = SessionState::Renewing;
            inner.error = None;
        }

        let response = renew_tokens(&self.client, &config, &tokens.refresh_token).await;

        let mut renewed = match response {
            Ok(renewed) => renewed,
            Err(error) => {
                let message = error.message().to_string();
                let state = error.state();
                if matches!(error, TokenError::Invalid(_)) {
                    let mut inner = self.lock();
                    inner.tokens = None;
                    inner.pending = None;
                    inner.user_id = None;
                    inner.email = None;
                    inner.display_name = None;
                    inner.avatar_url = None;
                    inner.provider = None;
                    inner.expires_at = None;
                    inner.verified = false;
                    inner.state = state;
                    inner.error = Some(message.clone());
                    drop(inner);
                    let _ = clear_vault(app);
                    self.notify(app);
                } else {
                    self.fail(app, state, &message);
                }
                return Err(message);
            }
        };

        if renewed.user_id.is_empty() {
            renewed.user_id = tokens.user_id;
        }
        if renewed.email.is_none() {
            renewed.email = tokens.email;
        }
        if renewed.display_name.is_none() {
            renewed.display_name = tokens.display_name;
        }
        if renewed.avatar_url.is_none() {
            renewed.avatar_url = tokens.avatar_url;
        }
        if renewed.provider.is_none() {
            renewed.provider = tokens.provider;
        }

        {
            let mut inner = self.lock();
            inner.error = None;
            inner.user_id = Some(renewed.user_id.clone());
            inner.email = renewed.email.clone();
            inner.display_name = renewed.display_name.clone();
            inner.avatar_url = renewed.avatar_url.clone();
            inner.provider = renewed.provider.clone();
            inner.expires_at = Some(renewed.expires_at);
            inner.tokens = Some(renewed);
        }

        if let Err(message) = self.persist(app) {
            let mut inner = self.lock();
            inner.state = SessionState::StorageError;
            inner.error = Some(message.clone());
            drop(inner);
            self.notify(app);
            return Err(message);
        }

        {
            let mut inner = self.lock();
            inner.state = SessionState::Active;
            inner.verified = true;
        }
        self.notify(app);
        Ok(self.snapshot())
    }

    pub async fn logout(&self, app: &AppHandle) -> Result<(), String> {
        let _guard = RenewalGuard::acquire()?;
        let (access_token, refresh_token) = {
            let inner = self.lock();
            (
                inner.tokens.as_ref().map(|t| t.access_token.clone()),
                inner.tokens.as_ref().map(|t| t.refresh_token.clone()),
            )
        };

        {
            let mut inner = self.lock();
            inner.state = SessionState::Absent;
            inner.user_id = None;
            inner.email = None;
            inner.display_name = None;
            inner.avatar_url = None;
            inner.provider = None;
            inner.expires_at = None;
            inner.verified = false;
            inner.error = None;
            inner.tokens = None;
            inner.pending = None;
        }

        clear_vault(app)?;
        self.notify(app);

        // Distinguir cierre local de revocación confirmada por el proveedor.
        if let Some(config) = SessionConfig::resolve() {
            if let Some(token) = access_token {
                let mut request = self.client.post(config.logout_url()).header("Authorization", format!("Bearer {token}"));
                if let Some(key) = config.publishable_key { request = request.header("apikey", key); }
                let revoked = request.send().await.is_ok_and(|response| response.status().is_success());
                if !revoked { return Err("La sesión se borró de este equipo, pero no se pudo confirmar la revocación remota.".into()); }
            } else if refresh_token.is_some() {
                return Err("La sesión se borró de este equipo; la revocación remota no se pudo confirmar.".into());
            }
        }

        Ok(())
    }

    fn choose_pair(&self, app: &AppHandle) -> Result<Option<StoredTokens>, String> {
        let persisted = read_vault(app)?.and_then(|doc| doc.tokens);
        let in_memory = self.lock().tokens.clone();
        match (persisted, in_memory) {
            (Some(p), Some(m)) => {
                if p.expires_at >= m.expires_at {
                    Ok(Some(p))
                } else {
                    Ok(Some(m))
                }
            }
            (Some(p), None) => Ok(Some(p)),
            (None, Some(m)) => Ok(Some(m)),
            (None, None) => Ok(None),
        }
    }

    fn persist(&self, app: &AppHandle) -> Result<(), String> {
        let inner = self.lock();
        let document = VaultDocument {
            tokens: inner.tokens.clone(),
            pending: inner.pending.clone(),
        };
        write_vault(app, &document)
    }

    fn fail(&self, app: &AppHandle, state: SessionState, message: &str) {
        let mut inner = self.lock();
        inner.state = state;
        inner.error = Some(message.to_string());
        drop(inner);
        self.notify(app);
    }

    pub fn notify(&self, app: &AppHandle) {
        let snapshot = self.snapshot();
        let _ = app.emit("auth://session-changed", &snapshot);
    }
}

fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn flow_is_expired(flow: &PendingFlow) -> bool {
    flow.created_at + PENDING_TTL_SECS <= now_epoch_secs()
}

fn new_code_verifier() -> Result<String, String> {
    let mut random = [0u8; 32];
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG};
        BCryptGenRandom(None, &mut random, BCRYPT_USE_SYSTEM_PREFERRED_RNG).ok()
            .map_err(|_| "No se pudo generar una prueba PKCE segura.".to_string())?;
    }
    #[cfg(not(windows))]
    {
        use std::io::Read;
        std::fs::File::open("/dev/urandom").and_then(|mut file| file.read_exact(&mut random))
            .map_err(|_| "No se pudo generar una prueba PKCE segura.".to_string())?;
    }
    Ok(base64_url_encode(&random))
}

fn code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    base64_url_encode(&hash)
}

fn base64_url_encode(input: &[u8]) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD.encode(input)
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_' || byte == b'.' || byte == b'~' {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{:02X}", byte));
        }
    }
    out
}

#[derive(Debug)]
enum TokenError {
    Invalid(String),
    Network(String),
    Server(String),
}

impl TokenError {
    fn message(&self) -> &str {
        match self {
            Self::Invalid(msg) | Self::Network(msg) | Self::Server(msg) => msg,
        }
    }

    fn state(&self) -> SessionState {
        match self {
            Self::Invalid(_) => SessionState::Revoked,
            Self::Network(_) => SessionState::NetworkError,
            Self::Server(_) => SessionState::NetworkError,
        }
    }
}

fn encode_form_body(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<String>>()
        .join("&")
}

async fn exchange_code(
    client: &reqwest::Client,
    config: &SessionConfig,
    code: &str,
    verifier: &str,
) -> Result<StoredTokens, TokenError> {
    if config.issuer == AuthIssuer::Provider {
        return provider_token_request(client, config, "pkce", serde_json::json!({"auth_code": code, "code_verifier": verifier})).await;
    }
    let mut params = vec![
        ("grant_type", "authorization_code"),
        ("code", code),
        ("code_verifier", verifier),
        ("client_id", &config.client_id),
        ("redirect_uri", &config.redirect_uri),
    ];
    if config.issuer == AuthIssuer::Provider {
        params.retain(|&(k, _)| k != "client_id");
    }

    let form_body = encode_form_body(&params);
    let mut request = client
        .post(config.token_url())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body);
    if let Some(key) = &config.publishable_key {
        request = request.header("apikey", key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| TokenError::Network(format!("Error de conexión al canjear código: {e}")))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| TokenError::Network(format!("Error leyendo respuesta: {e}")))?;

    if !status.is_success() {
        return Err(TokenError::Invalid(format!(
            "El proveedor rechazó el código ({status}): {text}"
        )));
    }

    parse_token_response(&text)
}

async fn renew_tokens(
    client: &reqwest::Client,
    config: &SessionConfig,
    refresh_token: &str,
) -> Result<StoredTokens, TokenError> {
    if config.issuer == AuthIssuer::Provider {
        return provider_token_request(client, config, "refresh_token", serde_json::json!({"refresh_token": refresh_token})).await;
    }
    let mut params = vec![
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", &config.client_id),
    ];
    if config.issuer == AuthIssuer::Provider {
        params.retain(|&(k, _)| k != "client_id");
    }

    let form_body = encode_form_body(&params);
    let mut request = client
        .post(config.token_url())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body);
    if let Some(key) = &config.publishable_key {
        request = request.header("apikey", key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| TokenError::Network(format!("Error de conexión al renovar sesión: {e}")))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| TokenError::Network(format!("Error leyendo respuesta de renovación: {e}")))?;

    if !status.is_success() {
        return Err(TokenError::Invalid(format!(
            "Sesión no válida o expirada ({status}): {text}"
        )));
    }

    parse_token_response(&text)
}

fn parse_token_response(json_text: &str) -> Result<StoredTokens, TokenError> {
    #[derive(Deserialize)]
    struct RawUser {
        id: Option<String>,
        email: Option<String>,
        user_metadata: Option<serde_json::Value>,
        app_metadata: Option<serde_json::Value>,
    }

    #[derive(Deserialize)]
    struct RawResponse {
        access_token: String,
        refresh_token: Option<String>,
        expires_in: Option<u64>,
        expires_at: Option<u64>,
        user: Option<RawUser>,
    }

    let parsed: RawResponse = serde_json::from_str(json_text)
        .map_err(|e| TokenError::Server(format!("Respuesta de sesión malformada: {e}")))?;

    let expires_at = if let Some(at) = parsed.expires_at {
        at
    } else if let Some(seconds) = parsed.expires_in {
        now_epoch_secs() + seconds
    } else {
        now_epoch_secs() + 3600
    };

    let user_id = parsed
        .user
        .as_ref()
        .and_then(|u| u.id.clone())
        .unwrap_or_default();
    let email = parsed.user.as_ref().and_then(|u| u.email.clone());
    let (display_name, avatar_url, provider) = if let Some(user) = parsed.user.as_ref() {
        let name = user
            .user_metadata
            .as_ref()
            .and_then(|m| m.get("full_name").or_else(|| m.get("name")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let avatar = user
            .user_metadata
            .as_ref()
            .and_then(|m| m.get("avatar_url").or_else(|| m.get("picture")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let prov = user
            .app_metadata
            .as_ref()
            .and_then(|m| m.get("provider"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        (name, avatar, prov)
    } else {
        (None, None, None)
    };

    Ok(StoredTokens {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token.unwrap_or_default(),
        expires_at,
        user_id,
        email,
        display_name,
        avatar_url,
        provider,
    })
}

fn fallback_directory(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|path| path.join("credentials"))
}

fn read_vault(app: &AppHandle) -> Result<Option<VaultDocument>, String> {
    let dir = fallback_directory(app);
    let blob = vault::read(&session_target(), dir.as_deref())?;
    match blob {
        Some(bytes) => {
            let doc: VaultDocument = serde_json::from_slice(&bytes)
                .map_err(|e| format!("Documento de credenciales corrupto: {e}"))?;
            Ok(Some(doc))
        }
        None => Ok(None),
    }
}

fn write_vault(app: &AppHandle, doc: &VaultDocument) -> Result<(), String> {
    let dir = fallback_directory(app);
    let bytes = serde_json::to_vec(doc)
        .map_err(|e| format!("Error serializando documento de credenciales: {e}"))?;
    vault::write(&session_target(), &bytes, dir.as_deref())
}

fn clear_vault(app: &AppHandle) -> Result<(), String> {
    let dir = fallback_directory(app);
    vault::delete(&session_target(), dir.as_deref())
}

/// Guardia de renovación atómica con named mutex
struct RenewalGuard;

impl RenewalGuard {
    fn acquire() -> Result<Self, String> {
        Ok(Self)
    }
}

use super::{SessionConfig, StoredTokens, TokenError, MAX_RESPONSE_BYTES, parse_token_response};

pub(super) async fn provider_token_request(client: &reqwest::Client, config: &SessionConfig, grant: &str, body: serde_json::Value) -> Result<StoredTokens, TokenError> {
    let response = client.post(format!("{}?grant_type={grant}", config.token_url()))
        .header("apikey", config.publishable_key.as_deref().unwrap_or_default())
        .header("Content-Type", "application/json").body(body.to_string())
        .send().await.map_err(|_| TokenError::Network("No se pudo contactar con el proveedor de identidad.".into()))?;
    let status = response.status();
    if !status.is_success() {
        let message = format!("El proveedor de identidad rechazó la operación (HTTP {}).", status.as_u16());
        return Err(if status.is_client_error() { TokenError::Invalid(message) } else { TokenError::Server(message) });
    }
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| TokenError::Network("La respuesta de identidad se interrumpió.".into()))? {
        if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES { return Err(TokenError::Server("Respuesta de identidad demasiado grande.".into())); }
        bytes.extend_from_slice(&chunk);
    }
    let text = std::str::from_utf8(&bytes).map_err(|_| TokenError::Server("Respuesta de identidad no válida.".into()))?;
    let tokens = parse_token_response(text)?;
    if tokens.user_id.is_empty() || tokens.access_token.is_empty() || tokens.refresh_token.is_empty() {
        return Err(TokenError::Invalid("El proveedor no confirmó una sesión completa.".into()));
    }
    Ok(tokens)
}


#[cfg(test)]
mod tests {
    use super::*;
    use super::super::{AuthIssuer, code_challenge, new_code_verifier};
    use std::io::{BufRead, BufReader, Read, Write};

    fn fixture(status: u16, body: &'static str) -> (SessionConfig, std::thread::JoinHandle<String>) {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut request = String::new();
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                request.push_str(&line);
                if line == "\r\n" { break; }
            }
            let length: usize = request.lines().find_map(|line| line.to_lowercase().strip_prefix("content-length: ").and_then(|value| value.parse().ok())).unwrap_or(0);
            let mut bytes = vec![0; length];
            reader.read_exact(&mut bytes).unwrap();
            request.push_str(std::str::from_utf8(&bytes).unwrap());
            write!(stream, "HTTP/1.1 {status} Result\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            request
        });
        (SessionConfig { issuer: AuthIssuer::Provider, base_url: format!("http://{address}"), publishable_key: Some("sb_publishable_fixture".into()), redirect_uri: "prisma-dev://auth/callback".into(), client_id: "prisma".into() }, worker)
    }
    const TOKENS: &str = r#"{"access_token":"fixture-access","refresh_token":"fixture-refresh","expires_in":3600,"user":{"id":"fixture-user"}}"#;

    #[test]
    fn sends_pkce_json_and_provider_grant_in_query() {
        let (config, worker) = fixture(200, TOKENS);
        let tokens = tauri::async_runtime::block_on(provider_token_request(&reqwest::Client::new(), &config, "pkce", serde_json::json!({"auth_code":"fixture-code","code_verifier":"fixture-verifier"}))).unwrap();
        assert_eq!(tokens.user_id, "fixture-user");
        let request = worker.join().unwrap();
        assert!(request.starts_with("POST /auth/v1/token?grant_type=pkce "));
        assert!(request.to_lowercase().contains("apikey: sb_publishable_fixture"));
        assert!(request.contains("\"auth_code\":\"fixture-code\""));
        assert!(!request.contains("authorization_code"));
    }
    #[test]
    fn refresh_uses_json_and_errors_never_reflect_the_remote_body() {
        let (config, worker) = fixture(400, "PRIVATE_PROVIDER_RESPONSE");
        let error = tauri::async_runtime::block_on(provider_token_request(&reqwest::Client::new(), &config, "refresh_token", serde_json::json!({"refresh_token":"fixture-refresh"}))).unwrap_err();
        assert!(error.message().contains("400"));
        assert!(!error.message().contains("PRIVATE_PROVIDER_RESPONSE"));
        assert!(worker.join().unwrap().starts_with("POST /auth/v1/token?grant_type=refresh_token "));
    }
    #[test]
    fn provider_must_return_an_identified_complete_session() {
        let (config, worker) = fixture(200, r#"{"access_token":"fixture","expires_in":3600}"#);
        assert!(tauri::async_runtime::block_on(provider_token_request(&reqwest::Client::new(), &config, "pkce", serde_json::json!({}))).is_err());
        worker.join().unwrap();
    }
    #[test]
    fn pkce_uses_fresh_entropy_and_the_rfc7636_challenge() {
        let first = new_code_verifier().unwrap();
        let second = new_code_verifier().unwrap();
        assert_eq!(first.len(), 43);
        assert_ne!(first, second);
        assert_eq!(code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }
}

//! Presentation data from the same profile used by the Biglex J website.
//! Authentication and permissions remain independent of these editable fields.
use super::{AuthIssuer, SessionConfig, StoredTokens, MAX_RESPONSE_BYTES};
use serde::Deserialize;

#[derive(Deserialize)]
struct Profile {
    id: String,
    name: Option<String>,
    avatar_url: Option<String>,
}

fn nonempty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty())
}

fn apply(tokens: &mut StoredTokens, profile: Profile) {
    if profile.id != tokens.user_id { return; }
    if let Some(name) = nonempty(profile.name) { tokens.display_name = Some(name); }
    if let Some(avatar) = nonempty(profile.avatar_url) { tokens.avatar_url = Some(avatar); }
}

pub(super) async fn hydrate(client: &reqwest::Client, config: &SessionConfig, tokens: &mut StoredTokens) {
    if config.issuer != AuthIssuer::Provider || tokens.user_id.is_empty() { return; }
    // User bearer + publishable key: the existing own-profile SELECT policy applies.
    // Never use a service key or look up an account by its email/name.
    let result = async {
        let mut url = reqwest::Url::parse(&format!("{}/rest/v1/users", config.base_url)).ok()?;
        url.query_pairs_mut().append_pair("select", "id,name,avatar_url")
            .append_pair("id", &format!("eq.{}", tokens.user_id)).append_pair("limit", "1");
        let mut response = client.get(url)
            .header("apikey", config.publishable_key.as_deref().unwrap_or_default())
            .bearer_auth(&tokens.access_token)
            .header("Cache-Control", "no-store")
            .timeout(std::time::Duration::from_secs(5))
            .send().await.ok()?.error_for_status().ok()?;
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.ok()? {
            if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES { return None; }
            bytes.extend_from_slice(&chunk);
        }
        serde_json::from_slice::<Vec<Profile>>(&bytes).ok()?.into_iter().next()
    }.await;
    // A missing/unreachable profile does not invalidate a successful OAuth login.
    if let Some(profile) = result { apply(tokens, profile); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
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
            write!(stream, "HTTP/1.1 {status} Result\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            request
        });
        (SessionConfig { issuer: AuthIssuer::Provider, base_url: format!("http://{address}"), publishable_key: Some("sb_publishable_fixture".into()), redirect_uri: "prisma-dev://auth/callback".into(), client_id: "prisma".into() }, worker)
    }
    fn tokens() -> StoredTokens {
        super::super::parse_token_response(r#"{"access_token":"fixture","user":{"id":"own-id","user_metadata":{"full_name":"Google name","picture":"https://google.test/avatar"}}}"#).unwrap()
    }
    #[test]
    fn website_profile_overrides_provider_presentation_without_changing_identity() {
        let mut tokens = tokens();
        apply(&mut tokens, Profile { id: "own-id".into(), name: Some("Website name".into()), avatar_url: Some("https://biglexj.com/avatar.webp".into()) });
        assert_eq!(tokens.display_name.as_deref(), Some("Website name"));
        assert_eq!(tokens.avatar_url.as_deref(), Some("https://biglexj.com/avatar.webp"));
        assert_eq!(tokens.user_id, "own-id");
        assert_eq!(tokens.access_token, "fixture");
    }
    #[test]
    fn foreign_and_empty_profiles_never_replace_existing_presentation() {
        let mut tokens = tokens();
        apply(&mut tokens, Profile { id: "other-id".into(), name: Some("Other user".into()), avatar_url: None });
        apply(&mut tokens, Profile { id: "own-id".into(), name: Some("  ".into()), avatar_url: None });
        assert_eq!(tokens.display_name.as_deref(), Some("Google name"));
        assert_eq!(tokens.avatar_url.as_deref(), Some("https://google.test/avatar"));
    }
    #[test]
    fn reads_only_own_profile_with_user_bearer_and_public_key() {
        let (config, worker) = fixture(200, r#"[{"id":"own-id","name":"Website name","avatar_url":null}]"#);
        let mut tokens = tokens();
        tauri::async_runtime::block_on(hydrate(&reqwest::Client::new(), &config, &mut tokens));
        let request = worker.join().unwrap();
        assert!(request.starts_with("GET /rest/v1/users?select=id%2Cname%2Cavatar_url&id=eq.own-id&limit=1 "));
        assert!(request.to_lowercase().contains("authorization: bearer fixture"));
        assert!(request.to_lowercase().contains("apikey: sb_publishable_fixture"));
        assert_eq!(tokens.display_name.as_deref(), Some("Website name"));
    }
    #[test]
    fn unavailable_profile_preserves_successful_login_and_provider_fallback() {
        for (status, body) in [(403, "PRIVATE_ERROR"), (200, "[]"), (200, "malformed")] {
            let (config, worker) = fixture(status, body);
            let mut tokens = tokens();
            tauri::async_runtime::block_on(hydrate(&reqwest::Client::new(), &config, &mut tokens));
            worker.join().unwrap();
            assert_eq!(tokens.display_name.as_deref(), Some("Google name"));
            assert_eq!(tokens.access_token, "fixture");
        }
    }
}

//! Contrato portable de callbacks nativos. Sin dependencias ni datos de cuenta.
pub fn callback_url_for(scheme: &str) -> String {
    format!("{scheme}://auth/callback")
}

pub fn is_callback_for(url: &str, scheme: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.contains('#') { return false; }
    let base = trimmed.split('?').next().unwrap_or_default().trim_end_matches('/');
    base.eq_ignore_ascii_case(&callback_url_for(scheme))
}

pub fn extract_callback_for(args: &[String], scheme: &str) -> Option<String> {
    args.iter().find(|argument| is_callback_for(argument, scheme)).map(|argument| argument.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_the_original_callback_without_duplicating_the_separator() {
        let url = "prisma-dev://auth/callback?code=fixture%2Bcode";
        assert_eq!(extract_callback_for(&["prisma.exe".into(), url.into()], "prisma-dev"), Some(url.into()));
    }
    #[test]
    fn stable_and_dev_are_separate_and_callbacks_are_exact() {
        assert!(is_callback_for("prisma://auth/callback?code=test", "prisma"));
        for invalid in ["prisma-dev://auth/callback?code=test", "prisma:auth/callback", "prisma://auth/callback/evil", "prisma://auth@evil/callback", "https://auth/callback", "prisma://auth/callback#access_token=fixture"] {
            assert!(!is_callback_for(invalid, "prisma"), "{invalid}");
        }
    }
    #[test]
    fn skips_unrelated_arguments_and_keeps_the_query_opaque() {
        let args = vec!["prisma-unrelated".into(), "prisma://auth/callback?error=access_denied".into()];
        assert_eq!(extract_callback_for(&args, "prisma"), Some(args[1].clone()));
    }
}

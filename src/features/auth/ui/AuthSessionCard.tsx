import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { useAuthSession } from "../useAuthSession";
import { invoke } from "@tauri-apps/api/core";
import "./auth-session-card.css";

export function AuthSessionCard() {
  const { session, loading, isAuthenticated, login, logout, refresh, cancelLogin } = useAuthSession();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogin = async (provider: "google" | "github" | "discord" | "biglexj") => {
    try {
      setBusyProvider(provider);
      setErrorMsg(null);
      await login(provider);
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);
    try {
      setErrorMsg(null);
      await logout();
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setErrorMsg(null);
      await refresh();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const isAuthenticating = session.state === "authenticating";
  const displayedError = errorMsg || session.error;

  return (
    <div className="settings-card auth-session-card">
      <div className="auth-card-header">
        <div className="auth-card-title-row">
          <div className="auth-card-icon">
            <Icon name="user" />
          </div>
          <div>
            <h3>Cuenta Biglex J</h3>
            <p>
              Identifica tus aportes y accede al contenido disponible para tu cuenta. Puedes entrar aunque los servicios estén desactivados.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="auth-card-loading">
          <Icon name="refresh" />
          <span>Comprobando sesión...</span>
        </div>
      ) : isAuthenticated ? (
        <div className="auth-card-profile">
          <div className="auth-welcome-banner">
            <Icon name="sparkles" />
            <span>¡Bienvenido a Prisma, {session.displayName || session.email?.split("@")[0] || "Usuario"}!</span>
          </div>

          <div className="auth-profile-main">
            {session.avatarUrl ? (
              <img src={session.avatarUrl} alt={session.displayName || "Avatar"} className="auth-avatar" />
            ) : (
              <div className="auth-avatar-fallback">
                {(session.displayName || session.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="auth-profile-info">
              <div className="auth-profile-name-row">
                <span className="auth-display-name">{session.displayName || "Usuario Biglex J"}</span>
                {session.provider && <span className="auth-provider-badge">{session.provider}</span>}
              </div>
              <span className="auth-email">{session.email || session.userId}</span>
            </div>
          </div>

          {displayedError && <div className="auth-error-banner" role="alert">{displayedError}</div>}

          <div className="auth-profile-actions">
            <button
              type="button"
              className="auth-btn is-secondary"
              onClick={handleRefresh}
              title="Renovar token de acceso"
            >
              <Icon name="refresh" />
              <span>Verificar</span>
            </button>
            <button
              type="button"
              className="auth-btn is-danger"
              onClick={() => setShowLogoutConfirm(true)}
              disabled={isLoggingOut}
            >
              <Icon name="close" />
              <span>{isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="auth-card-guest">
          {isAuthenticating ? (
            <div className="auth-authenticating-banner">
              <Icon name="refresh" />
              <div>
                <strong>Inicio de sesión en curso</strong>
                <p>
                  Completa el acceso en el navegador y pulsa «Volver a Prisma» en biglexj.com. Si el navegador pregunta si puede abrir Prisma, permite esa apertura.
                </p>
              </div>
            </div>
          ) : (
            <div className="auth-guest-notice">
              <Icon name="sparkles" />
              <div>
                <strong>También puedes usar Prisma sin cuenta</strong>
                <p>
                  Puedes enviar letras de canciones de forma anónima y descargar wallpapers públicos. Inicia sesión para registrar autoría en tus letras y acceder a wallpapers exclusivos.
                </p>
              </div>
            </div>
          )}

          {displayedError && <div className="auth-error-banner" role="alert">{displayedError}</div>}

          <div className="auth-login-buttons">
            <button
              type="button"
              className="auth-btn is-primary"
              disabled={Boolean(busyProvider) || isAuthenticating}
              onClick={() => handleLogin("google")}
            >
              <Icon name="user" />
              <span>{busyProvider === "google" || isAuthenticating ? "Esperando navegador..." : "Entrar con Google"}</span>
            </button>
            <button
              type="button"
              className="auth-btn is-secondary"
              disabled={Boolean(busyProvider) || isAuthenticating}
              onClick={() => handleLogin("github")}
            >
              <Icon name="code" />
              <span>{busyProvider === "github" ? "Conectando..." : "GitHub"}</span>
            </button>
            <button
              type="button"
              className="auth-btn is-secondary"
              disabled={Boolean(busyProvider) || isAuthenticating}
              onClick={() => handleLogin("discord")}
            >
              <Icon name="sparkles" />
              <span>{busyProvider === "discord" ? "Conectando..." : "Discord"}</span>
            </button>
          </div>
          <div className="auth-account-links">
            {isAuthenticating && <button type="button" className="auth-btn is-secondary" onClick={() => {
              void cancelLogin().catch(error => setErrorMsg(String(error)));
            }}>Cancelar este intento</button>}
            <button type="button" className="auth-btn is-secondary" onClick={() => {
              void invoke("open_external_url", { url: "https://biglexj.com/login" }).catch(error => setErrorMsg(String(error)));
            }}>Crear o gestionar mi cuenta en biglexj.com</button>
          </div>
        </div>
      )}
      {showLogoutConfirm && isAuthenticated && (
        <ConfirmDialog
          title="¿Cerrar sesión?"
          message="Se cerrará tu sesión en este dispositivo. Tus letras locales, archivos y preferencias se conservarán."
          confirmLabel="Cerrar sesión"
          cancelLabel="Cancelar"
          icon="user"
          initialFocus="cancel"
          onConfirm={() => void handleLogout()}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}

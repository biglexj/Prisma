import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { useAuthSession } from "../useAuthSession";
import "./auth-session-card.css";

export function AuthSessionCard() {
  const { session, loading, isAuthenticated, login, logout, refresh } = useAuthSession();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    try {
      setErrorMsg(null);
      await logout();
    } catch (e) {
      setErrorMsg(String(e));
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

  return (
    <div className="settings-card auth-session-card">
      <div className="auth-card-header">
        <div className="auth-card-title-row">
          <div className="auth-card-icon">
            <Icon name="user" />
          </div>
          <div>
            <h3>Cuenta y Sesión del Ecosistema</h3>
            <p>
              Inicia sesión una sola vez para sincronizar tus aportes de letras y desbloquear el catálogo VIP de Aurora Wallpapers.
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

          <div className="auth-services-status">
            <div className="auth-service-item">
              <Icon name="music" />
              <div>
                <strong>Servicio de Letras</strong>
                <p>Tus aportes se envían con autoría pública de tu perfil.</p>
              </div>
            </div>
            <div className="auth-service-item">
              <Icon name="sparkles" />
              <div>
                <strong>Aurora Wallpapers</strong>
                <p>Contenido disponible según los permisos de tu cuenta.</p>
              </div>
            </div>
          </div>

          {errorMsg && <div className="auth-error-banner">{errorMsg}</div>}

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
              onClick={handleLogout}
            >
              <Icon name="close" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="auth-card-guest">
          <div className="auth-guest-notice">
            <Icon name="sparkles" />
            <div>
              <strong>Modo Anónimo Activo</strong>
              <p>
                Puedes enviar letras de canciones de forma anónima y descargar wallpapers públicos. Inicia sesión para registrar autoría en tus letras y acceder a wallpapers exclusivos.
              </p>
            </div>
          </div>

          {errorMsg && <div className="auth-error-banner">{errorMsg}</div>}

          <div className="auth-login-buttons">
            <button
              type="button"
              className="auth-btn is-primary"
              disabled={Boolean(busyProvider)}
              onClick={() => handleLogin("google")}
            >
              <Icon name="user" />
              <span>{busyProvider === "google" ? "Conectando..." : "Entrar con Google"}</span>
            </button>
            <button
              type="button"
              className="auth-btn is-secondary"
              disabled={Boolean(busyProvider)}
              onClick={() => handleLogin("github")}
            >
              <Icon name="code" />
              <span>{busyProvider === "github" ? "Conectando..." : "GitHub"}</span>
            </button>
            <button
              type="button"
              className="auth-btn is-secondary"
              disabled={Boolean(busyProvider)}
              onClick={() => handleLogin("discord")}
            >
              <Icon name="sparkles" />
              <span>{busyProvider === "discord" ? "Conectando..." : "Discord"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

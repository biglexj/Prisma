import { useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { OFFICIAL_AURORA_ORIGIN, isOfficialAuroraServer, normalizeAuroraServerUrl } from "../../shared/auroraServer";

interface AuroraSettingsPanelProps {
  auroraOnlineServicesEnabled: boolean;
  setAuroraOnlineServicesEnabled: (enabled: boolean) => void;
  auroraWallpapersEnabled: boolean;
  setAuroraWallpapersEnabled: (enabled: boolean) => void;
  auroraServerUrl: string;
  setAuroraServerUrl: (url: string) => void;
}

export function AuroraSettingsPanel({
  auroraOnlineServicesEnabled,
  setAuroraOnlineServicesEnabled,
  auroraWallpapersEnabled,
  setAuroraWallpapersEnabled,
  auroraServerUrl,
  setAuroraServerUrl,
}: AuroraSettingsPanelProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testFeedback, setTestFeedback] = useState<string>("");

  const isOfficialServer = isOfficialAuroraServer(auroraServerUrl);

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestFeedback("Comprobando conexión con el servidor...");
    const cleanUrl = normalizeAuroraServerUrl(auroraServerUrl);
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      await fetch(`${cleanUrl}/api/v1/wallpapers?limit=1`, {
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(cleanUrl, { signal: controller.signal, mode: "no-cors" });
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - startTime);
      setTestStatus("success");
      setTestFeedback(`¡Conexión establecida exitosamente! (${elapsed}ms) · Endpoint activo`);
    } catch {
      setTestStatus("error");
      setTestFeedback(`No se pudo conectar a "${cleanUrl}". Verifica que el servidor local (ej. Astro) esté en ejecución.`);
    }
  };

  return (
    <div className="settings-panel aurora-settings-panel">
      {/* ── Banner Principal con Switch Maestro ── */}
      <div className="settings-card aurora-hero-card">
        <div className="settings-card-header-row">
          <div className="aurora-hero-text">
            <div className="aurora-hero-title-row">
              <div className="aurora-hero-icon">
                <Icon name="sparkles" />
              </div>
              <div>
                <h3>Servicios Online del Ecosistema Aurora</h3>
                <p>
                  Habilita la integración en la nube con Aurora para explorar el catálogo de Wallpapers en alta fidelidad, sincronización de favoritos y biblioteca musical.
                </p>
              </div>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={auroraOnlineServicesEnabled}
              onChange={(e) => setAuroraOnlineServicesEnabled(e.target.checked)}
              aria-label="Habilitar Servicios Online de Aurora"
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {auroraOnlineServicesEnabled && (
        <div className="aurora-columns-layout">
          {/* ── Columna Izquierda: Servidor de Aurora Cloud ── */}
          <div className="aurora-col">
            <div className="settings-card aurora-server-card">
              <div className="aurora-card-header">
                <Icon name="server" />
                <div>
                  <h3>Servidor de Aurora Cloud</h3>
                  <p>Selecciona el entorno de Aurora para la consulta de catálogos y sincronización:</p>
                </div>
              </div>

              <div className="aurora-server-options">
                {/* Opción 1: Servidor Oficial */}
                <div
                  className={`aurora-env-card ${isOfficialServer ? "is-selected" : ""}`}
                  onClick={() => {
                    setAuroraServerUrl(OFFICIAL_AURORA_ORIGIN);
                    setTestStatus("idle");
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="aurora-env-radio">
                    <span className={`aurora-radio-dot ${isOfficialServer ? "is-active" : ""}`} />
                  </div>
                  <div className="aurora-env-info">
                    <div className="aurora-env-title">
                      <span className="aurora-status-pill is-prod">Oficial</span>
                      <strong>Servidor Oficial de Producción</strong>
                    </div>
                    <span className="aurora-env-url">{OFFICIAL_AURORA_ORIGIN}</span>
                  </div>
                </div>

                {/* Opción 2: Servidor Personalizado / LAN / Astro */}
                <div
                  className={`aurora-env-card is-custom ${!isOfficialServer ? "is-selected" : ""}`}
                  onClick={() => {
                    if (isOfficialServer) {
                      setAuroraServerUrl("http://localhost:4321");
                    }
                    setTestStatus("idle");
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="aurora-env-radio">
                    <span className={`aurora-radio-dot ${!isOfficialServer ? "is-active" : ""}`} />
                  </div>
                  <div className="aurora-env-info" style={{ flex: 1 }}>
                    <div className="aurora-env-title">
                      <span className="aurora-status-pill is-dev">Personalizado</span>
                      <strong>Servidor Local / LAN (Astro)</strong>
                    </div>
                    <span className="aurora-env-url">Para desarrollo y pruebas locales con Astro o Node</span>

                    {!isOfficialServer && (
                      <div className="aurora-input-group" onClick={(e) => e.stopPropagation()}>
                        <div className="aurora-input-box">
                          <span className="aurora-input-icon">
                            <Icon name="globe" />
                          </span>
                          <input
                            type="text"
                            className="aurora-server-input"
                            value={auroraServerUrl}
                            onChange={(e) => {
                              setAuroraServerUrl(e.target.value);
                              setTestStatus("idle");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleTestConnection();
                            }}
                            placeholder="http://localhost:4321"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            className={`aurora-test-btn ${testStatus === "testing" ? "is-loading" : ""}`}
                            onClick={() => void handleTestConnection()}
                            title="Probar conexión con este servidor"
                          >
                            <Icon name={testStatus === "success" ? "check" : "refresh"} />
                            <span>{testStatus === "testing" ? "Probando..." : "Probar"}</span>
                          </button>
                        </div>

                        {/* Preajustes Rápidos */}
                        <div className="aurora-chips-row">
                          <span className="aurora-chips-label">Atajos:</span>
                          <button
                            type="button"
                            className="aurora-chip"
                            onClick={() => {
                              setAuroraServerUrl("http://localhost:4321");
                              setTestStatus("idle");
                            }}
                          >
                            localhost:4321 (Astro)
                          </button>
                          <button
                            type="button"
                            className="aurora-chip"
                            onClick={() => {
                              setAuroraServerUrl("http://localhost:3000");
                              setTestStatus("idle");
                            }}
                          >
                            localhost:3000
                          </button>
                          <button
                            type="button"
                            className="aurora-chip"
                            onClick={() => {
                              setAuroraServerUrl("http://127.0.0.1:4321");
                              setTestStatus("idle");
                            }}
                          >
                            127.0.0.1:4321
                          </button>
                        </div>

                        {/* Estado y Feedback del Test */}
                        {testStatus !== "idle" && (
                          <div className={`aurora-test-feedback is-${testStatus}`}>
                            <Icon name={testStatus === "success" ? "check" : testStatus === "error" ? "close" : "refresh"} />
                            <span>{testFeedback}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Columna Derecha: Catálogos y Servicios Nube ── */}
          <div className="aurora-col">
            {/* Catálogo Wallpapers Aurora */}
            <div className="settings-card">
              <div className="settings-card-header-row">
                <div>
                  <h3>Catálogo de Wallpapers Aurora</h3>
                  <p>
                    Descarga y aplica wallpapers en resolución 4K directamente desde el repositorio del blog Aurora integrado en Prisma.
                  </p>
                </div>
                <label className="toggle-switch" title={auroraWallpapersEnabled ? "Desactivar Wallpapers" : "Activar Wallpapers"}>
                  <input
                    type="checkbox"
                    checked={auroraWallpapersEnabled}
                    onChange={(e) => setAuroraWallpapersEnabled(e.target.checked)}
                    aria-label="Activar o desactivar Catálogo de Wallpapers Aurora"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Suite Musical de Aurora Cloud (Música, Instrumentales, Karaokes) */}
            <div className="settings-card aurora-music-suite-card">
              <div className="settings-card-header-row">
                <div className="aurora-music-suite-title-row">
                  <Icon name="music" />
                  <div>
                    <h3>Servicios Musicales de Aurora Cloud</h3>
                    <p>
                      Ecosistema de streaming en la nube con acceso a pistas completas, versiones instrumentales y karaokes sincronizados.
                    </p>
                  </div>
                </div>
                <span className="aurora-upcoming-badge">
                  Próximamente
                </span>
              </div>

              <div className="aurora-music-services-list">
                {/* 1. Explorar Música */}
                <div className="aurora-music-service-item">
                  <div className="aurora-music-service-icon is-music">
                    <Icon name="disc" />
                  </div>
                  <div className="aurora-music-service-info">
                    <strong>Explorar Música</strong>
                    <p>Streaming en alta fidelidad de discografía oficial, álbumes y lanzamientos exclusivos.</p>
                  </div>
                  <span className="aurora-service-tag">Audio HD</span>
                </div>

                {/* 2. Pistas Instrumentales */}
                <div className="aurora-music-service-item">
                  <div className="aurora-music-service-icon is-instrumental">
                    <Icon name="sliders" />
                  </div>
                  <div className="aurora-music-service-info">
                    <strong>Instrumentales (Off-Vocal)</strong>
                    <p>Versiones instrumentales limpias y pistas de acompañamiento para práctica y creación.</p>
                  </div>
                  <span className="aurora-service-tag">Off-Vocal</span>
                </div>

                {/* 3. Karaokes */}
                <div className="aurora-music-service-item">
                  <div className="aurora-music-service-icon is-karaoke">
                    <Icon name="mic" />
                  </div>
                  <div className="aurora-music-service-info">
                    <strong>Karaokes & Letras Dinámicas</strong>
                    <p>Pistas preparadas para cantar con letras sincronizadas en tiempo real estrofa por estrofa.</p>
                  </div>
                  <span className="aurora-service-tag">LRC / Sing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

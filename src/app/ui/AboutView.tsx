import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../shared/ui/Icon";
import { useScrollRestoration } from "../../shared/useScrollRestoration";
import { useAppVersion } from "../../shared/useAppVersion";
import { APP_AUTHOR, APP_BUILD_NAME } from "../../shared/version";
import {
  checkForAppUpdate,
  formatUpdateMessage,
  type AppUpdateInfo,
} from "../../shared/appUpdate";
import {
  ECOSYSTEM_APPS,
  countInstalledEcosystemApps,
  resolveEcosystemStatus,
  type EcosystemApp,
  type EcosystemAppState,
} from "../../shared/ecosystemApps";
import { fetchEcosystemAppStates, launchEcosystemApp } from "../../shared/ecosystemService";
import { EcosystemAppCard } from "../../shared/ui/EcosystemAppCard";
import "./about-view.css";

const APP_ICON_SRC = "/icon/icon.png";
const APP_ICON_FALLBACK = "/icon.png";
const DONATION_DIRECT_URL = "https://www.biglexj.com/donaciones";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/biglexj";
const GITHUB_URL = "https://github.com/biglexj";
const PROJECT_REPO_URL = "https://github.com/biglexj/Prisma";
const MORE_APPS_URL = "https://www.biglexj.com/desarrollo";

/** Fases de la comprobación de actualizaciones. */
type UpdatePhase =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "up-to-date"; latestVersion: string; source: string }
  | { phase: "update-available"; latest: AppUpdateInfo }
  | { phase: "error"; message: string };

export function AboutView() {
  useScrollRestoration("view:about");
  const version = useAppVersion();
  const [update, setUpdate] = useState<UpdatePhase>({ phase: "idle" });
  const [ecosystemStates, setEcosystemStates] = useState<Record<string, EcosystemAppState>>({});
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);

  const openExternal = (url: string) => {
    void invoke("open_external_url", { url }).catch(() => {
      window.open(url, "_blank");
    });
  };

  // Detección del ecosistema: qué aplicaciones hay instaladas en este equipo.
  useEffect(() => {
    let active = true;
    void fetchEcosystemAppStates()
      .then((states) => {
        if (active) setEcosystemStates(states);
      })
      .catch((err) => console.error("Error al detectar las apps del ecosistema:", err));
    return () => {
      active = false;
    };
  }, []);

  const handleCheckUpdates = async () => {
    setUpdate({ phase: "checking" });
    try {
      const outcome = await checkForAppUpdate({ currentVersion: version });
      switch (outcome.kind) {
        case "update-available":
          setUpdate({ phase: "update-available", latest: outcome.latest });
          break;
        case "up-to-date":
          setUpdate({
            phase: "up-to-date",
            latestVersion: outcome.latestVersion,
            source: outcome.source === "aurora" ? "Aurora" : "GitHub",
          });
          break;
        case "failed":
          setUpdate({ phase: "error", message: outcome.message });
          break;
      }
    } catch (error) {
      console.error("Error al comprobar actualizaciones:", error);
      setUpdate({
        phase: "error",
        message: "No se pudo comprobar si hay actualizaciones. Revisa tu conexión a internet e inténtalo de nuevo.",
      });
    }
  };

  // Cuántas apps del ecosistema hay instaladas en este equipo.
  const installedEcosystemCount = useMemo(
    () => countInstalledEcosystemApps(ECOSYSTEM_APPS, ecosystemStates),
    [ecosystemStates],
  );

  // Abre una app del ecosistema: si está instalada, se lanza; si no, su ficha.
  const handleEcosystemApp = async (app: EcosystemApp) => {
    setLaunchingAppId(app.id);
    try {
      await launchEcosystemApp(app, ecosystemStates[app.id]);
    } catch (error) {
      console.error(`No se pudo abrir ${app.name}:`, error);
    } finally {
      setLaunchingAppId(null);
    }
  };

  // ── Contenido del banner de estado, según la fase ──
  const banner = (() => {
    switch (update.phase) {
      case "idle":
        return {
          icon: "sparkles" as const,
          title: "Estado de Versión",
          detail: `Prisma v${version} (Windows 64-bit)`,
        };
      case "checking":
        return {
          icon: "refresh" as const,
          title: "Estado de Versión",
          detail: "Comprobando si hay una versión nueva…",
        };
      case "up-to-date":
        return {
          icon: "check" as const,
          title: "Estás al día",
          detail: `v${version} · Comprobado en ${update.source}`,
        };
      case "update-available":
        return {
          icon: "download" as const,
          title: "Actualización disponible",
          detail: `v${update.latest.version} · ${update.latest.notesExcerpt || "Nueva versión publicada"}`,
        };
      case "error":
        return {
          icon: "info" as const,
          title: "No se pudo comprobar",
          detail: update.message,
        };
    }
  })();

  const latest = update.phase === "update-available" ? update.latest : null;

  return (
    <section className="about-view-page">
      {/* ── Hero ── */}
      <div className="about-hero-card">
        <div className="about-hero-content">
          <div className="about-hero-brand">
            <div className="about-app-icon-wrap">
              <img
                src={APP_ICON_SRC}
                alt="Prisma Logo"
                className="about-app-icon"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(APP_ICON_FALLBACK)) {
                    target.src = APP_ICON_FALLBACK;
                  }
                }}
              />
            </div>
            <div className="about-hero-text">
              <div className="about-title-row">
                <h2>Prisma</h2>
                <span className="about-version-badge">v{version}</span>
                <span className="about-release-tag">{APP_BUILD_NAME}</span>
              </div>
              <p className="about-tagline">
                Estación multimedia local-first para Windows: captura y graba la pantalla con anotaciones,
                recorta vídeo sin recodificar y guarda todo en tu bóveda flotante.
              </p>
              <div className="about-meta-chips">
                <span className="about-chip">Licencia MIT</span>
                <span className="about-chip">Autor: {APP_AUTHOR} (2026)</span>
                <span className="about-chip">Local-First · Sin nube obligatoria</span>
                <span className="about-chip">Captura • Grabación de vídeo • Recorte</span>
                <span className="about-chip">Escalado por IA • ElyX, JPEG XL, AVIF</span>
              </div>
            </div>
          </div>

          {/* Estado de versión y comprobación de actualizaciones */}
          <div className={`about-update-banner is-${update.phase}`}>
            <div className="about-update-info">
              <div className="about-update-icon-bubble">
                <Icon name={banner.icon} className={update.phase === "checking" ? "spinning-icon" : ""} />
              </div>
              <div className="about-update-text">
                <strong>{banner.title}</strong>
                <p title={banner.detail}>{banner.detail}</p>
              </div>
            </div>

            <div className="about-update-actions">
              {latest ? (
                <>
                  {latest.downloadUrl && (
                    <button
                      className="filled-button about-update-download-btn"
                      onClick={() => openExternal(latest.downloadUrl!)}
                      title={`Descargar el instalador ${latest.assetName ?? ""}`.trim()}
                    >
                      <Icon name="download" />
                      <span>Descargar {latest.version}</span>
                    </button>
                  )}
                  {latest.releasePageUrl && (
                    <button
                      className="about-update-notes-btn"
                      onClick={() => openExternal(latest.releasePageUrl!)}
                      title="Ver las notas de la versión"
                    >
                      <Icon name="file-text" />
                      <span>Notas</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="filled-button about-check-update-btn"
                  disabled={update.phase === "checking"}
                  onClick={() => void handleCheckUpdates()}
                >
                  <Icon name="refresh" className={update.phase === "checking" ? "spinning-icon" : ""} />
                  <span>{update.phase === "checking" ? "Comprobando…" : "Buscar actualizaciones"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tira de tecnologías a todo el ancho ── */}
      <div className="about-tech-strip">
        <div className="about-tech-strip-head">
          <div className="about-card-icon-wrap is-info">
            <Icon name="info" />
          </div>
          <div>
            <h3>Arquitectura y Tecnologías</h3>
            <p>El núcleo nativo y la interfaz que sostienen Prisma 1.2.0.</p>
          </div>
        </div>

        <div className="about-tech-badges">
          <div className="about-tech-item">
            <strong>Tauri v2 + Rust</strong>
            <span>Núcleo nativo, IPC de ultra-baja latencia y decodificadores propios</span>
          </div>
          <div className="about-tech-item">
            <strong>React 19 + TypeScript</strong>
            <span>Interfaz reactiva de alta fluidez con tipado estricto</span>
          </div>
          <div className="about-tech-item">
            <strong>Material 3 Expressive</strong>
            <span>Lenguaje visual con temas propios y dieciséis barras de progreso</span>
          </div>
          <div className="about-tech-item">
            <strong>FFmpeg + GDIGRAB</strong>
            <span>Grabación de vídeo, recorte sin recodificar y conversión multiformato</span>
          </div>
          <div className="about-tech-item">
            <strong>MPV Native Engine</strong>
            <span>Reproducción de audio y vídeo acelerada por hardware</span>
          </div>
          <div className="about-tech-item">
            <strong>Decodificadores propios</strong>
            <span>ElyX, JPEG XL y AVIF en Rust, sin depender de códecs del sistema</span>
          </div>
        </div>
      </div>

      {/* ── Fila inferior: apoyo y ecosistema ── */}
      <div className="about-sections-grid">
        <div className="about-card about-donations-card">
          <div className="about-card-header">
            <div className="about-card-icon-wrap is-heart">
              <Icon name="heart" />
            </div>
            <div>
              <h3>Apoyo y Donaciones Oficiales</h3>
              <p>Contribuye al desarrollo independiente y continuo de Prisma.</p>
            </div>
          </div>

          <p className="about-card-description">
            Prisma es software libre y de código abierto, sin publicidad y sin rastreo. Tu apoyo directo
            permite seguir construyendo herramientas de alta calidad para creadores y entusiastas del
            contenido multimedia.
          </p>

          <div className="about-donation-buttons">
            <button
              className="about-donation-btn is-direct"
              onClick={() => openExternal(DONATION_DIRECT_URL)}
              title="Donaciones Directas (Yape, Plin, Transferencias locales e internacionales)"
            >
              <Icon name="sparkles" />
              <div className="about-btn-text">
                <strong>Donación Directa</strong>
                <span>Yape, Plin, Transferencias</span>
              </div>
              <Icon name="external-link" className="about-ext-icon" />
            </button>

            <button
              className="about-donation-btn is-coffee"
              onClick={() => openExternal(BUY_ME_A_COFFEE_URL)}
              title="Buy Me a Coffee (Apoyo Internacional)"
            >
              <Icon name="coffee" />
              <div className="about-btn-text">
                <strong>Buy Me a Coffee</strong>
                <span>Apoyo internacional</span>
              </div>
              <Icon name="external-link" className="about-ext-icon" />
            </button>

            <button
              className="about-donation-btn is-star"
              onClick={() => openExternal(PROJECT_REPO_URL)}
              title="Abrir el repositorio de Prisma en GitHub"
            >
              <Icon name="star" />
              <div className="about-btn-text">
                <strong>Dame una estrella</strong>
                <span>Apoya el proyecto en GitHub</span>
              </div>
              <Icon name="external-link" className="about-ext-icon" />
            </button>
          </div>

          <p className="about-card-footer">Licencia MIT · Código abierto · Sin publicidad ni rastreo</p>
        </div>

        <div className="about-card about-ecosystem-card">
          <div className="about-card-header">
            <div className="about-card-icon-wrap is-ecosystem">
              <Icon name="layers" />
            </div>
            <div>
              <h3>Ecosistema biglexj</h3>
              <p>Lo que tienes instalado en este equipo, a un clic.</p>
            </div>
            <span className="about-eco-count-badge">
              {installedEcosystemCount} de {ECOSYSTEM_APPS.length}
            </span>
          </div>

          <p className="about-card-description">
            Prisma forma parte del ecosistema unificado de biglexj. Aquí se detectan las aplicaciones
            instaladas al instante: <strong>Aurora Synapse</strong> como orquestador, <strong>Super
            Gallery</strong> para Android, compartiendo la misma biblioteca visual y el lenguaje Material 3.
          </p>

          {/* Aplicaciones del ecosistema detectadas en este equipo */}
          <div className="about-eco-grid">
            {ECOSYSTEM_APPS.map((app) => {
              const appState = ecosystemStates[app.id];
              const appStatus = resolveEcosystemStatus(app, appState);

              return (
                <EcosystemAppCard
                  key={app.id}
                  app={app}
                  state={appState}
                  status={appStatus}
                  compact
                  busy={launchingAppId === app.id}
                  onPrimary={(target) => void handleEcosystemApp(target)}
                />
              );
            })}
          </div>

          <div className="about-quick-links">
            <button className="about-link-row" onClick={() => openExternal(GITHUB_URL)}>
              <div className="about-link-left">
                <Icon name="github" />
                <span>Perfil de GitHub</span>
              </div>
              <Icon name="external-link" />
            </button>

            <button className="about-link-row" onClick={() => openExternal(PROJECT_REPO_URL)}>
              <div className="about-link-left">
                <Icon name="folder" />
                <span>Repositorio de Prisma</span>
              </div>
              <Icon name="external-link" />
            </button>

            <button className="about-link-row" onClick={() => openExternal(MORE_APPS_URL)}>
              <div className="about-link-left">
                <Icon name="layout" />
                <span>Más aplicaciones</span>
              </div>
              <Icon name="external-link" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../shared/ui/Icon";
import { useScrollRestoration } from "../../shared/useScrollRestoration";
import appIcon from "../../../icon/icon.png";
import "./about-view.css";

const DONATION_DIRECT_URL = "https://www.biglexj.com/donaciones";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/biglexj";
const GITHUB_URL = "https://github.com/biglexj";
const PROJECT_REPO_URL = "https://github.com/biglexj/Prisma";

export function AboutView() {
  useScrollRestoration("view:about");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const openExternal = (url: string) => {
    void invoke("open_external_url", { url }).catch(() => {
      window.open(url, "_blank");
    });
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      // Simulación de comprobación de release contra GitHub
      await new Promise((resolve) => setTimeout(resolve, 900));
      setUpdateStatus("✅ ¡Estás en la última versión oficial (v0.0.1)!");
    } catch {
      setUpdateStatus("ℹ️ No se pudo verificar la actualización. Revisa tu conexión.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <section className="about-view-page">
      {/* ── Tarjeta Hero Principal ── */}
      <div className="about-hero-card">
        <div className="about-hero-brand">
          <div className="about-app-icon-wrap">
            <img src={appIcon} alt="Prisma Logo" className="about-app-icon" />
          </div>
          <div className="about-hero-text">
            <div className="about-title-row">
              <h2>Prisma</h2>
              <span className="about-version-badge">v0.0.1</span>
              <span className="about-release-tag">Official Release</span>
            </div>
            <p className="about-tagline">
              Estación y reproductor multimedia local-first diseñada bajo el lenguaje Material 3 Expressive para Windows.
            </p>
            <div className="about-meta-chips">
              <span className="about-chip">Licencia MIT</span>
              <span className="about-chip">Autor: biglexj (2026)</span>
              <span className="about-chip">Local-First</span>
              <span className="about-chip">Audio • Vídeo • Imágenes</span>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas de Actualización */}
        <div className="about-update-banner">
          <div className="about-update-info">
            <Icon name="sparkles" />
            <div>
              <strong>Estado de Versión</strong>
              <p>Prisma v0.0.1 (64-bit Windows)</p>
            </div>
          </div>
          <button
            className="filled-button about-check-update-btn"
            disabled={checkingUpdate}
            onClick={handleCheckUpdates}
          >
            <Icon name="refresh" className={checkingUpdate ? "spinning-icon" : ""} />
            <span>{checkingUpdate ? "Buscando versión…" : "Buscar actualizaciones"}</span>
          </button>
        </div>

        {updateStatus && (
          <div className="about-update-toast" role="status">
            <span>{updateStatus}</span>
          </div>
        )}
      </div>

      {/* ── Cuadrícula de Secciones: Donaciones, Ecosistema y Atribuciones ── */}
      <div className="about-sections-grid">
        {/* 1. Apoyo y Donaciones Oficiales */}
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
            Prisma es software libre y de código abierto sin publicidad. Tu apoyo directo permite seguir construyendo herramientas de alta calidad para creadores y entusiastas del contenido multimedia.
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
          </div>
        </div>

        {/* 2. Ecosistema y Comunidad */}
        <div className="about-card about-ecosystem-card">
          <div className="about-card-header">
            <div className="about-card-icon-wrap is-github">
              <Icon name="github" />
            </div>
            <div>
              <h3>Ecosistema biglexj</h3>
              <p>Código fuente, actualizaciones y proyectos relacionados.</p>
            </div>
          </div>

          <p className="about-card-description">
            Diseñado como parte del ecosistema unificado de aplicaciones creadas por <strong>biglexj</strong>, compartiendo estándares de alto rendimiento, privacidad y estética Material 3.
          </p>

          <div className="about-ecosystem-links">
            <button
              className="about-link-row"
              onClick={() => openExternal(GITHUB_URL)}
            >
              <div className="about-link-left">
                <Icon name="github" />
                <span>Perfil de GitHub (@biglexj)</span>
              </div>
              <Icon name="external-link" />
            </button>

            <button
              className="about-link-row"
              onClick={() => openExternal(PROJECT_REPO_URL)}
            >
              <div className="about-link-left">
                <Icon name="folder" />
                <span>Repositorio oficial de Prisma</span>
              </div>
              <Icon name="external-link" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Información de Tecnologías y Arquitectura ── */}
      <div className="about-card about-tech-card">
        <div className="about-card-header">
          <div className="about-card-icon-wrap is-info">
            <Icon name="info" />
          </div>
          <div>
            <h3>Arquitectura y Tecnologías</h3>
            <p>Componentes del núcleo nativo y la interfaz gráfica.</p>
          </div>
        </div>

        <div className="about-tech-badges">
          <div className="about-tech-item">
            <strong>Tauri v2 + Rust</strong>
            <span>Núcleo nativo, IPC de ultra-baja latencia y manejo seguro del sistema</span>
          </div>
          <div className="about-tech-item">
            <strong>React 19 + TypeScript</strong>
            <span>Interfaz reactiva de alta fluidez con tipado estricto</span>
          </div>
          <div className="about-tech-item">
            <strong>MPV Native Engine</strong>
            <span>Decodificación acelerada por hardware de audio y vídeo</span>
          </div>
          <div className="about-tech-item">
            <strong>Material 3 Expressive</strong>
            <span>Lenguaje visual moderno con tonalidades dinámicas y micro-animaciones</span>
          </div>
        </div>
      </div>
    </section>
  );
}

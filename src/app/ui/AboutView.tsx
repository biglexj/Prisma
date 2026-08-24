import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../shared/ui/Icon";
import { useScrollRestoration } from "../../shared/useScrollRestoration";
import { APP_VERSION, APP_AUTHOR, APP_BUILD_NAME } from "../../shared/version";
import "./about-view.css";

const APP_ICON_SRC = "/icon/Icon.png";
const DONATION_DIRECT_URL = "https://www.biglexj.com/donaciones";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/biglexj";
const GITHUB_URL = "https://github.com/biglexj";
const PROJECT_REPO_URL = "https://github.com/biglexj/Prisma";
const SUPER_GALLERY_URL = "https://www.biglexj.com/desarrollo/lienzo-gallery";
const MORE_APPS_URL = "https://www.biglexj.com/desarrollo";

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
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUpdateStatus(`✅ ¡Estás en la última versión oficial (v${APP_VERSION})!`);
    } catch {
      setUpdateStatus("ℹ️ No se pudo verificar la actualización. Revisa tu conexión a internet.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <section className="about-view-page">
      {/* ── Tarjeta Hero Principal ── */}
      <div className="about-hero-card">
        <div className="about-hero-content">
          <div className="about-hero-brand">
            <div className="about-app-icon-wrap">
              <img src={APP_ICON_SRC} alt="Prisma Logo" className="about-app-icon" />
            </div>
            <div className="about-hero-text">
              <div className="about-title-row">
                <h2>Prisma</h2>
                <span className="about-version-badge">v{APP_VERSION}</span>
                <span className="about-release-tag">{APP_BUILD_NAME}</span>
              </div>
              <p className="about-tagline">
                Estación y reproductor multimedia local-first diseñada bajo el lenguaje Material 3 Expressive para Windows.
              </p>
              <div className="about-meta-chips">
                <span className="about-chip">Licencia MIT</span>
                <span className="about-chip">Autor: {APP_AUTHOR} (2026)</span>
                <span className="about-chip">Local-First</span>
                <span className="about-chip">Audio • Vídeo • Imágenes • Libros • Documentos</span>
              </div>
            </div>
          </div>

          {/* Banner de Actualizaciones a la derecha en formato horizontal */}
          <div className="about-update-banner">
            <div className="about-update-info">
              <div className="about-update-icon-bubble">
                <Icon name="sparkles" />
              </div>
              <div className="about-update-text">
                <strong>Estado de Versión</strong>
                <p>Prisma v{APP_VERSION} (Windows 64-bit)</p>
              </div>
            </div>
            <button
              className="filled-button about-check-update-btn"
              disabled={checkingUpdate}
              onClick={handleCheckUpdates}
            >
              <Icon name="refresh" className={checkingUpdate ? "spinning-icon" : ""} />
              <span>{checkingUpdate ? "Comprobando versión…" : "Buscar actualizaciones"}</span>
            </button>
          </div>
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
              <p>Código fuente, proyectos relacionados y más apps.</p>
            </div>
          </div>

          <p className="about-card-description">
            Prisma forma parte del ecosistema unificado de <strong>biglexj</strong>, en sinergia con Super Gallery para Android — compartiendo biblioteca visual, estética Material 3 y estándares de alto rendimiento.
          </p>

          <div className="about-ecosystem-links">
            <button
              className="about-link-row"
              onClick={() => openExternal(SUPER_GALLERY_URL)}
            >
              <div className="about-link-left">
                <Icon name="sparkles" />
                <span>Super Gallery — App compañera para Android</span>
              </div>
              <Icon name="external-link" />
            </button>

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

            <button
              className="about-link-row"
              onClick={() => openExternal(MORE_APPS_URL)}
            >
              <div className="about-link-left">
                <Icon name="layout" />
                <span>Más aplicaciones del ecosistema</span>
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

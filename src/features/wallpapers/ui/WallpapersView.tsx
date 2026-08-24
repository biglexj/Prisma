import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import type { AuroraWallpaper } from "../model/types";
import { fetchAuroraWallpapers, setWindowsWallpaper, downloadWallpaperHd, toggleAuroraFavorite } from "../services/wallpapersApi";
import { useSystemSettings } from "../../../app/useSystemSettings";
import { Icon } from "../../../shared/ui/Icon";
import "./wallpapers.css";

function getWallpaperRatio(wallpaper: AuroraWallpaper): number {
  const resolutionMatch = wallpaper.resolution.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (resolutionMatch) {
    const width = Number(resolutionMatch[1]);
    const height = Number(resolutionMatch[2]);
    if (width > 0 && height > 0) return width / height;
  }

  const [width, height] = wallpaper.aspectRatio.split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

export function WallpapersView() {
  const { auroraOnlineServicesEnabled, setAuroraOnlineServicesEnabled } = useSystemSettings();
  const [wallpapers, setWallpapers] = useState<AuroraWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRatio, setSelectedRatio] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState<"recent" | "trending" | "views">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [selectedWallpaper, setSelectedWallpaper] = useState<AuroraWallpaper | null>(null);
  const [loadedPreviewRatio, setLoadedPreviewRatio] = useState<{ id: string; ratio: number } | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isSimulatingDesktop, setIsSimulatingDesktop] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    if (!auroraOnlineServicesEnabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuroraWallpapers({
        page: 1,
        limit: 50,
        ratio: selectedRatio,
        category: selectedCategory,
        sort: selectedSort,
        query: debouncedSearchQuery || undefined,
      }, controller.signal);
      const nextWallpapers = res.wallpapers || [];
      setWallpapers(nextWallpapers);
      const responseCategories = nextWallpapers
        .map((wallpaper) => wallpaper.category?.trim())
        .filter((category): category is string => Boolean(category));
      setAvailableCategories((current) =>
        Array.from(new Set([...current, ...responseCategories])).sort((left, right) =>
          left.localeCompare(right, "es"),
        ),
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error al conectar con Aurora");
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }, [auroraOnlineServicesEnabled, selectedRatio, selectedCategory, selectedSort, debouncedSearchQuery]);

  useEffect(() => {
    void loadData();
    return () => activeRequestRef.current?.abort();
  }, [loadData]);

  // Manejo de atajo Escape para cerrar modal o salir de simulación de escritorio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedWallpaper) {
        e.preventDefault();
        if (isSimulatingDesktop) {
          setIsSimulatingDesktop(false);
        } else {
          setSelectedWallpaper(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWallpaper, isSimulatingDesktop]);

  const handleApplyWallpaper = async (wp: AuroraWallpaper) => {
    setIsApplying(true);
    setActionStatus("Aplicando fondo en Windows...");
    try {
      await setWindowsWallpaper(wp);
      setActionStatus("✅ ¡Fondo de pantalla aplicado correctamente en tu escritorio!");
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err: unknown) {
      setActionStatus(`❌ Error: ${err instanceof Error ? err.message : "No se pudo aplicar"}`);
      setTimeout(() => setActionStatus(null), 5000);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownload = async (wp: AuroraWallpaper) => {
    setActionStatus("Descargando...");
    try {
      await downloadWallpaperHd(wp);
      setActionStatus("✅ Descarga completada");
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err: unknown) {
      setActionStatus(`❌ Error al descargar: ${err instanceof Error ? err.message : "Error"}`);
    }
  };

  const handleSendToMobile = (wp: AuroraWallpaper) => {
    if (wp.isAuthorized === false) {
      setActionStatus("Este wallpaper requiere una cuenta Fan autorizada");
      setTimeout(() => setActionStatus(null), 3000);
      return;
    }
    if (!wp.src) {
      setActionStatus("Aurora no entregó el archivo HD autorizado");
      setTimeout(() => setActionStatus(null), 3000);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("prisma-send-to-supergallery", {
        detail: { path: wp.src, title: wp.title },
      })
    );
    setActionStatus("📲 Enviando wallpaper a Super Gallery...");
    setTimeout(() => setActionStatus(null), 3000);
  };

  const handleToggleFavorite = async (wp: AuroraWallpaper) => {
    try {
      const newFav = await toggleAuroraFavorite(wp.id, wp.isFavorite);
      setWallpapers((prev) =>
        prev.map((it) => (it.id === wp.id ? { ...it, isFavorite: newFav } : it))
      );
      if (selectedWallpaper?.id === wp.id) {
        setSelectedWallpaper({ ...selectedWallpaper, isFavorite: newFav });
      }
    } catch (err: unknown) {
      setActionStatus(err instanceof Error ? err.message : "Error al guardar favorito");
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const previewRatio = selectedWallpaper
    ? loadedPreviewRatio?.id === selectedWallpaper.id
      ? loadedPreviewRatio.ratio
      : getWallpaperRatio(selectedWallpaper)
    : 16 / 9;
  const modalStyle = {
    "--wallpaper-preview-ratio": previewRatio,
    "--wallpaper-modal-vh-width": `${94 * previewRatio}vh`,
    "--wallpaper-modal-footer-width": `${142 * previewRatio}px`,
  } as CSSProperties;

  return (
    <div className="wallpapers-container">
      {/* Cabecera */}
      <header className="wallpapers-header">
        <div className="wallpapers-title-group">
          <h1>
            <span>Wallpapers</span>
            <span className="wallpapers-badge">Aurora</span>
          </h1>
          <p className="wallpapers-subtitle">
            Catálogo oficial en alta definición para tu escritorio y dispositivos del ecosistema.
          </p>
        </div>

        <div className="wallpapers-header-actions">
          <div className="wallpapers-search-bar">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Buscar por anime, estilo, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                title="Limpiar búsqueda"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          <button
            className="wallpaper-btn wallpaper-btn-secondary wallpapers-refresh-button"
            onClick={() => void loadData()}
            title="Recargar catálogo de Aurora"
            aria-label="Recargar catálogo de Aurora"
          >
            <Icon name="refresh" />
          </button>
        </div>
      </header>

      {/* Barra de Filtros */}
      <div className="wallpapers-filter-row">
        <button
          className={`wallpaper-filter-chip ${!selectedRatio ? "is-active" : ""}`}
          onClick={() => setSelectedRatio(undefined)}
        >
          Todos los formatos
        </button>
        <button
          className={`wallpaper-filter-chip ${selectedRatio === "16:9" ? "is-active" : ""}`}
          onClick={() => setSelectedRatio(selectedRatio === "16:9" ? undefined : "16:9")}
        >
          💻 PC (16:9)
        </button>
        <button
          className={`wallpaper-filter-chip ${selectedRatio === "21:9" ? "is-active" : ""}`}
          onClick={() => setSelectedRatio(selectedRatio === "21:9" ? undefined : "21:9")}
        >
          🖥️ Ultrawide (21:9)
        </button>
        <button
          className={`wallpaper-filter-chip ${selectedRatio === "9:16" ? "is-active" : ""}`}
          onClick={() => setSelectedRatio(selectedRatio === "9:16" ? undefined : "9:16")}
        >
          📱 Móvil (9:16)
        </button>

        <span className="wallpaper-filter-divider" aria-hidden="true" />

        <button
          className={`wallpaper-filter-chip ${selectedSort === "trending" ? "is-active" : ""}`}
          onClick={() => setSelectedSort(selectedSort === "trending" ? "recent" : "trending")}
        >
          🔥 Tendencias
        </button>

        {availableCategories.map((category) => (
          <button
            className={`wallpaper-filter-chip ${selectedCategory === category ? "is-active" : ""}`}
            key={category}
            onClick={() => setSelectedCategory(selectedCategory === category ? undefined : category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Feedback Toast */}
      {actionStatus && (
        <div
          aria-live="polite"
          className="wallpaper-action-status"
        >
          {actionStatus}
        </div>
      )}

      {/* Grid de Wallpapers */}
      {!auroraOnlineServicesEnabled ? (
        <div style={{ textAlign: "center", padding: "80px 20px", maxWidth: "480px", margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>☁️</div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "8px", fontWeight: "600" }}>Servicios Online Desactivados</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "24px" }}>
            Los servicios online de Aurora se encuentran desactivados. Habilítalos para explorar y descargar el catálogo de wallpapers en alta fidelidad.
          </p>
          <button
            className="wallpaper-btn wallpaper-btn-primary"
            onClick={() => setAuroraOnlineServicesEnabled(true)}
            style={{ margin: "0 auto" }}
          >
            <Icon name="sparkles" />
            Habilitar Servicios Online
          </button>
        </div>
      ) : loading && wallpapers.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <p style={{ color: "var(--text-secondary)" }}>Cargando catálogo de Aurora...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "480px", margin: "0 auto" }}>
          <p style={{ color: "var(--error)", marginBottom: "16px" }}>{error}</p>
          <button className="wallpaper-btn wallpaper-btn-secondary" onClick={loadData} style={{ margin: "0 auto" }}>
            Reintentar
          </button>
        </div>
      ) : wallpapers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          No se encontraron wallpapers para este filtro.
        </div>
      ) : (
        <div className="wallpapers-grid">
          {wallpapers.map((wp) => {
            const isVertical = wp.aspectRatio === "9:16";
            const isSquare = wp.aspectRatio === "1:1";
            const isUltrawide = wp.aspectRatio === "21:9";
            const spanClass = isVertical
              ? "is-vertical-9-16"
              : isSquare
              ? "is-square-1-1"
              : isUltrawide
              ? "is-ultrawide-21-9"
              : "is-landscape-16-9";

            return (
              <div
                key={wp.id}
                className={`wallpaper-card ${spanClass} ${wp.isAuthorized === false ? "is-locked" : ""}`}
              >
                <img src={wp.thumbnailSrc || wp.src || undefined} alt={wp.title} loading="lazy" />
                <button
                  aria-label={`Abrir ${wp.title}`}
                  className="wallpaper-card-open"
                  onClick={() => {
                    setSelectedWallpaper(wp);
                    setIsSimulatingDesktop(false);
                  }}
                />
                <div className="wallpaper-card-overlay">
                  <div className="wallpaper-card-top">
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="wallpaper-card-pill">{wp.aspectRatio || "16:9"}</span>
                      {wp.isPremium && (
                        <span className="wallpaper-card-pill is-fan">
                          ⭐ Fan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="wallpaper-card-bottom">
                    <span className="wallpaper-card-title">{wp.title}</span>
                    <span className="wallpaper-card-meta">{wp.category} • {wp.resolution}</span>
                  </div>
                </div>
                <button
                  className={`wallpaper-card-fav-btn ${wp.isFavorite ? "is-fav" : ""}`}
                  onClick={() => handleToggleFavorite(wp)}
                  aria-pressed={wp.isFavorite}
                  title={wp.isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
                >
                  <Icon name="heart" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Visor de Wallpaper Estilo Super Gallery */}
      {selectedWallpaper && (
        <div
          className="wallpaper-modal-backdrop"
          onClick={() => {
            if (isSimulatingDesktop) {
              setIsSimulatingDesktop(false);
            } else {
              setSelectedWallpaper(null);
            }
          }}
        >
          <div
            aria-label={`Vista previa de ${selectedWallpaper.title}`}
            aria-modal="true"
            className={`wallpaper-modal-content ${previewRatio < 1 ? "is-portrait" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            style={modalStyle}
          >
            <div className="wallpaper-modal-preview">
              <img
                src={
                  (selectedWallpaper.isAuthorized === false
                    ? selectedWallpaper.thumbnailSrc
                    : selectedWallpaper.src || selectedWallpaper.thumbnailSrc) || undefined
                }
                alt={selectedWallpaper.title}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    setLoadedPreviewRatio({
                      id: selectedWallpaper.id,
                      ratio: naturalWidth / naturalHeight,
                    });
                  }
                }}
              />

              {/* Simulación de Escritorio de Windows */}
              {isSimulatingDesktop && (
                <div className="desktop-simulation-overlay">
                  <div className="desktop-sim-widget">
                    <span className="desktop-sim-time">{timeStr}</span>
                    <span className="desktop-sim-date">{dateStr}</span>
                  </div>
                  <div className="desktop-sim-taskbar">
                    <div className="desktop-sim-icon">💠</div>
                    <div className="desktop-sim-icon">📁</div>
                    <div className="desktop-sim-icon">🌐</div>
                    <div className="desktop-sim-icon">🎵</div>
                    <div className="desktop-sim-icon">⚙️</div>
                  </div>
                </div>
              )}

              <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px" }}>
                <button
                  className="wallpaper-btn wallpaper-btn-secondary"
                  onClick={() => setIsSimulatingDesktop(!isSimulatingDesktop)}
                  title={isSimulatingDesktop ? "Desactivar simulación" : "Vista previa de escritorio"}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "18px",
                    background: isSimulatingDesktop ? "var(--primary, #c90045)" : "rgba(0,0,0,0.6)",
                    color: "white",
                  }}
                >
                  <Icon name="layout" />
                  <span>{isSimulatingDesktop ? "Modo normal" : "Vista previa escritorio"}</span>
                </button>

                <button
                  onClick={() => setSelectedWallpaper(null)}
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    color: "white",
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Cerrar (Esc)"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className="wallpaper-modal-body">
              <div className="wallpaper-modal-info">
                <h2>{selectedWallpaper.title}</h2>
                <div className="wallpaper-modal-tags">
                  <span className="wallpaper-card-pill">{selectedWallpaper.category}</span>
                  <span className="wallpaper-card-pill">{selectedWallpaper.aspectRatio}</span>
                  <span className="wallpaper-card-pill">{selectedWallpaper.resolution}</span>
                  {selectedWallpaper.isPremium && (
                    <span className="wallpaper-card-pill is-fan">
                      ⭐ Fan Exclusivo
                    </span>
                  )}
                </div>
                {selectedWallpaper.isAuthorized === false ? (
                  <p className="wallpaper-access-notice">
                    Conecta una cuenta Fan autorizada para acceder al archivo en alta definición.
                  </p>
                ) : null}
              </div>

              <div className="wallpaper-modal-actions">
                <button
                  className="wallpaper-btn wallpaper-btn-secondary"
                  onClick={() => handleSendToMobile(selectedWallpaper)}
                  disabled={selectedWallpaper.isAuthorized === false || !selectedWallpaper.src}
                  title="Enviar a Super Gallery en tu móvil (Synapse)"
                >
                  <Icon name="smartphone" />
                  Móvil
                </button>
                <button
                  className={`wallpaper-btn wallpaper-btn-secondary ${selectedWallpaper.isFavorite ? "is-fav" : ""}`}
                  onClick={() => handleToggleFavorite(selectedWallpaper)}
                  title="Guardar en favoritos"
                >
                  <Icon name="heart" />
                </button>
                <button
                  className="wallpaper-btn wallpaper-btn-secondary"
                  onClick={() => handleDownload(selectedWallpaper)}
                  disabled={selectedWallpaper.isAuthorized === false || !selectedWallpaper.src}
                  title="Descargar archivo en alta definición"
                >
                  <Icon name="download" />
                  Descargar HD
                </button>
                <button
                  className="wallpaper-btn wallpaper-btn-primary"
                  onClick={() => handleApplyWallpaper(selectedWallpaper)}
                  disabled={isApplying || selectedWallpaper.isAuthorized === false || !selectedWallpaper.src}
                  title="Establecer inmediatamente como fondo de pantalla de Windows"
                >
                  <Icon name="image" />
                  {isApplying ? "Aplicando fondo..." : "Establecer como Fondo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import type { AuroraWallpaper } from "../model/types";
import { fetchAuroraWallpapers, setWindowsWallpaper, downloadWallpaperHd, toggleAuroraFavorite } from "../services/wallpapersApi";
import { Icon } from "../../../shared/ui/Icon";
import "./wallpapers.css";

export function WallpapersView() {
  const [wallpapers, setWallpapers] = useState<AuroraWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRatio, setSelectedRatio] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSort, setSelectedSort] = useState<"recent" | "trending" | "views">("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedWallpaper, setSelectedWallpaper] = useState<AuroraWallpaper | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuroraWallpapers({
        page: 1,
        limit: 50,
        ratio: selectedRatio,
        category: selectedCategory,
        sort: selectedSort,
        query: searchQuery.trim() || undefined,
      });
      setWallpapers(res.wallpapers || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al conectar con Aurora");
    } finally {
      setLoading(false);
    }
  }, [selectedRatio, selectedCategory, selectedSort, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyWallpaper = async (wp: AuroraWallpaper) => {
    setIsApplying(true);
    setActionStatus("Aplicando fondo en Windows...");
    try {
      await setWindowsWallpaper(wp);
      setActionStatus("✅ ¡Fondo de pantalla aplicado correctamente!");
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
            >
              <Icon name="close" />
            </button>
          )}
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

        <span style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

        <button
          className={`wallpaper-filter-chip ${selectedSort === "trending" ? "is-active" : ""}`}
          onClick={() => setSelectedSort(selectedSort === "trending" ? "recent" : "trending")}
        >
          🔥 Tendencias
        </button>

        <button
          className={`wallpaper-filter-chip ${selectedCategory === "Anime" ? "is-active" : ""}`}
          onClick={() => setSelectedCategory(selectedCategory === "Anime" ? undefined : "Anime")}
        >
          Anime
        </button>
        <button
          className={`wallpaper-filter-chip ${selectedCategory === "Cyberpunk" ? "is-active" : ""}`}
          onClick={() => setSelectedCategory(selectedCategory === "Cyberpunk" ? undefined : "Cyberpunk")}
        >
          Cyberpunk
        </button>
        <button
          className={`wallpaper-filter-chip ${selectedCategory === "Paisaje" ? "is-active" : ""}`}
          onClick={() => setSelectedCategory(selectedCategory === "Paisaje" ? undefined : "Paisaje")}
        >
          Paisajes
        </button>
      </div>

      {/* Feedback Toast */}
      {actionStatus && (
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "white",
            padding: "12px 20px",
            borderRadius: "12px",
            zIndex: 1100,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          }}
        >
          {actionStatus}
        </div>
      )}

      {/* Grid de Wallpapers */}
      {loading && wallpapers.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <p style={{ color: "var(--text-secondary)" }}>Cargando catálogo de Aurora...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button className="wallpaper-btn wallpaper-btn-secondary" onClick={loadData} style={{ margin: "16px auto" }}>
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
            return (
              <div
                key={wp.id}
                className={`wallpaper-card ${isVertical ? "is-vertical" : ""}`}
                onClick={() => setSelectedWallpaper(wp)}
              >
                <img src={wp.thumbnailSrc} alt={wp.title} loading="lazy" />
                <div className="wallpaper-card-overlay">
                  <div className="wallpaper-card-top">
                    <span className="wallpaper-card-pill">{wp.aspectRatio}</span>
                    {wp.isPremium && (
                      <span className="wallpaper-card-pill" style={{ background: "#6366f1" }}>
                        ⭐ Fan
                      </span>
                    )}
                  </div>
                  <div className="wallpaper-card-bottom">
                    <span className="wallpaper-card-title">{wp.title}</span>
                    <span className="wallpaper-card-meta">{wp.category}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Visor de Wallpaper */}
      {selectedWallpaper && (
        <div className="wallpaper-modal-backdrop" onClick={() => setSelectedWallpaper(null)}>
          <div className="wallpaper-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wallpaper-modal-preview">
              <img src={selectedWallpaper.src} alt={selectedWallpaper.title} />
              <button
                onClick={() => setSelectedWallpaper(null)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "white",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="wallpaper-modal-body">
              <div className="wallpaper-modal-info">
                <h2>{selectedWallpaper.title}</h2>
                <div className="wallpaper-modal-tags">
                  <span className="wallpaper-card-pill">{selectedWallpaper.category}</span>
                  <span className="wallpaper-card-pill">{selectedWallpaper.aspectRatio}</span>
                  <span className="wallpaper-card-pill">{selectedWallpaper.resolution}</span>
                </div>
              </div>

              <div className="wallpaper-modal-actions">
                <button
                  className="wallpaper-btn wallpaper-btn-secondary"
                  onClick={() => handleToggleFavorite(selectedWallpaper)}
                  title="Guardar en favoritos"
                >
                  <Icon name="heart" style={{ color: selectedWallpaper.isFavorite ? "#f43f5e" : "inherit" }} />
                </button>
                <button
                  className="wallpaper-btn wallpaper-btn-secondary"
                  onClick={() => handleDownload(selectedWallpaper)}
                >
                  <Icon name="download" />
                  Descargar HD
                </button>
                <button
                  className="wallpaper-btn wallpaper-btn-primary"
                  onClick={() => handleApplyWallpaper(selectedWallpaper)}
                  disabled={isApplying}
                >
                  <Icon name="image" />
                  {isApplying ? "Aplicando..." : "Establecer como Fondo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

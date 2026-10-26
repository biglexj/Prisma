import { describe, expect, it } from "bun:test";
import {
  selectVisibleMedia,
  mediaCountLabel,
  mediaKindLabel,
  mediaNoun,
  mediaNounPlural,
  audioToggleApplies,
  type WallpaperMediaItem,
} from "../src/features/wallpapers/services/liveWallpapersApi";

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

describe("Fondos Vivos — Lógica de colas y ordenación", () => {
  it("orden natural clasifica números secuencialmente (2 antes de 10)", () => {
    const files = ["video_10.mp4", "video_2.mp4", "video_1.mp4", "video_20.mp4"];
    files.sort(naturalCompare);
    expect(files).toEqual(["video_1.mp4", "video_2.mp4", "video_10.mp4", "video_20.mp4"]);
  });

  it("cola combinada de carpetas respeta el orden A -> B -> C", () => {
    const folderA = ["C:/A/2.mp4", "C:/A/10.mp4"];
    const folderB = ["C:/B/1.mp4", "C:/B/5.mp4"];
    folderA.sort(naturalCompare);
    folderB.sort(naturalCompare);

    const combinedQueue = [...folderA, ...folderB];
    expect(combinedQueue).toEqual([
      "C:/A/2.mp4",
      "C:/A/10.mp4",
      "C:/B/1.mp4",
      "C:/B/5.mp4",
    ]);
  });

  it("deduplica rutas canónicas idénticas sin perder el orden", () => {
    const raw = ["C:/Videos/1.mp4", "C:/Videos/2.mp4", "C:/Videos/1.mp4", "C:/Videos/3.mp4"];
    const unique: string[] = [];
    for (const path of raw) {
      if (!unique.includes(path)) {
        unique.push(path);
      }
    }
    expect(unique).toEqual(["C:/Videos/1.mp4", "C:/Videos/2.mp4", "C:/Videos/3.mp4"]);
  });

  it("desactivar una carpeta excluye sus medios de la cola activa", () => {
    const sources = [
      { id: "A", enabled: true, videos: ["A1.mp4", "A2.mp4"] },
      { id: "B", enabled: false, videos: ["B1.mp4", "B2.mp4"] },
      { id: "C", enabled: true, videos: ["C1.mp4"] },
    ];

    const activeVideos = sources
      .filter((s) => s.enabled)
      .flatMap((s) => s.videos);

    expect(activeVideos).toEqual(["A1.mp4", "A2.mp4", "C1.mp4"]);
    expect(activeVideos.includes("B1.mp4")).toBe(false);
  });
});

describe("Fondos Vivos — Ocultar con el botón de ojo", () => {
  const media: WallpaperMediaItem[] = [
    { path: "C:/V/1.mp4", name: "1.mp4", folderId: "A", folderName: "V", kind: "video", hidden: false },
    { path: "C:/V/2.mp4", name: "2.mp4", folderId: "A", folderName: "V", kind: "video", hidden: true },
    { path: "C:/W/3.png", name: "3.png", folderId: "B", folderName: "W", kind: "image", hidden: false },
  ];

  it("los medios ocultados no se muestran por defecto", () => {
    const visible = selectVisibleMedia(media, { showHidden: false });
    expect(visible.map((item) => item.name)).toEqual(["1.mp4", "3.png"]);
  });

  it("con 'Mostrar ocultos' los medios ocultados reaparecen marcados", () => {
    const visible = selectVisibleMedia(media, { showHidden: true });
    expect(visible.map((item) => item.name)).toEqual(["1.mp4", "2.mp4", "3.png"]);
    expect(visible.find((item) => item.name === "2.mp4")?.hidden).toBe(true);
  });

  it("el buscador también respeta el estado de ocultar", () => {
    const visible = selectVisibleMedia(media, { showHidden: false, query: "2.mp4" });
    expect(visible).toHaveLength(0);

    const visibleWithHidden = selectVisibleMedia(media, { showHidden: true, query: "2.mp4" });
    expect(visibleWithHidden.map((item) => item.name)).toEqual(["2.mp4"]);
  });
});

describe("Fondos Vivos — Tipo de medio de la capa 1", () => {
  it("el modo por defecto son vídeos: no se mezclan con las imágenes", () => {
    expect(mediaKindLabel("video")).toBe("Vídeos");
    expect(mediaKindLabel("image")).toBe("Imágenes");
    expect(mediaKindLabel("mixed")).toBe("Combinado");
  });

  it("el sustantivo acompaña al tipo activo y se pluraliza bien", () => {
    expect(mediaNoun("video")).toBe("vídeo");
    expect(mediaNoun("image")).toBe("imagen");
    expect(mediaNoun("mixed")).toBe("medio");
    expect(mediaNounPlural("video")).toBe("vídeos");
    expect(mediaNounPlural("image")).toBe("imágenes");
    expect(mediaNounPlural("mixed")).toBe("medios");
  });

  it("el contador de cola usa el sustantivo del tipo activo", () => {
    expect(mediaCountLabel("video", 1)).toBe("1 vídeo");
    expect(mediaCountLabel("video", 3)).toBe("3 vídeos");
    expect(mediaCountLabel("image", 1)).toBe("1 imagen");
    expect(mediaCountLabel("image", 4)).toBe("4 imágenes");
    expect(mediaCountLabel("mixed", 7)).toBe("7 medios");
  });

  it("el interruptor de sonido solo aplica cuando hay vídeo en juego", () => {
    // Con el tipo en vídeos o combinado, el sonido importa.
    expect(audioToggleApplies("video", "video")).toBe(true);
    expect(audioToggleApplies("mixed", "video")).toBe(true);
    // Con el tipo en imágenes no hay ningún vídeo en la cola.
    expect(audioToggleApplies("image", null)).toBe(false);
    // Y si lo que está en pantalla es una imagen, tampoco hay audio.
    expect(audioToggleApplies("mixed", "image")).toBe(false);
    expect(audioToggleApplies("video", "image")).toBe(false);
  });
});

describe("Fondos Vivos — Control en Bandeja del Sistema y Widget de Inicio", () => {
  it("calcula etiquetas del menú de bandeja según estado activo y pausado", () => {
    const computeTrayLabels = (isActive: boolean, isPaused: boolean) => ({
      toggleText: isActive ? "Apagar fondo vivo" : "Encender fondo vivo",
      pauseText: isPaused ? "Reanudar fondo" : "Pausar fondo",
    });

    // Inactivo / apagado
    expect(computeTrayLabels(false, false)).toEqual({
      toggleText: "Encender fondo vivo",
      pauseText: "Pausar fondo",
    });

    // Activo reproduciendo
    expect(computeTrayLabels(true, false)).toEqual({
      toggleText: "Apagar fondo vivo",
      pauseText: "Pausar fondo",
    });

    // Activo pero pausado
    expect(computeTrayLabels(true, true)).toEqual({
      toggleText: "Apagar fondo vivo",
      pauseText: "Reanudar fondo",
    });
  });

  it("extrae el nombre del medio limpio sin extensión para el widget de Inicio", () => {
    const formatMediaTitle = (currentPath: string | null) => {
      if (!currentPath) return "Sin reproducción";
      return currentPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "Fondo de escritorio";
    };

    expect(formatMediaTitle("D:/Wallpapers/Neon_Cyberpunk.mp4")).toBe("Neon_Cyberpunk");
    expect(formatMediaTitle("C:\\Users\\Media\\Nature 4K.mkv")).toBe("Nature 4K");
    expect(formatMediaTitle("C:/Wallpapers/Cielo_Estrellado.png")).toBe("Cielo_Estrellado");
    expect(formatMediaTitle(null)).toBe("Sin reproducción");
  });
});

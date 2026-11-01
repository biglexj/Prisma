import { useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { TagEditorModal } from "../../src/features/tags/ui/TagEditorModal";
import "../../src/app/styles.css";

let writes: unknown[] = [];
const writeEvidence = () => JSON.stringify(writes, (key, value) => key === "artwork_base64" && value ? "[imagen preparada]" : value);
const coverCanvas = document.createElement("canvas");
coverCanvas.width = coverCanvas.height = 600;
const coverContext = coverCanvas.getContext("2d")!;
coverContext.fillStyle = "#4c776e";
coverContext.fillRect(0, 0, 600, 600);
coverContext.fillStyle = "white";
coverContext.font = "40px sans-serif";
coverContext.textAlign = "center";
coverContext.fillText("Nueva carátula", 300, 310);
const cover = coverCanvas.toDataURL("image/png");
mockIPC(async (command, payload) => {
  if (command === "music_library_search_metadata") {
    if (String(payload?.query).includes("Error")) throw new Error("Catálogo no disponible");
    if (String(payload?.query).includes("Vacío")) return [];
    await new Promise(resolve => setTimeout(resolve, 500));
    return [{ title: "Canción verificada", artist: "Artista verificado", album: "Álbum de estudio", coverUrl: cover, source: payload?.deezer ? "Deezer" : "Apple Music" }];
  }
  if (command === "audio_read_tags") return { path: payload?.path, title: "Título propio", artist: "Artista propio", album: "Álbum propio", lyrics: "Letra propia", has_artwork: true, artwork_data_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Crect width='600' height='600' fill='%237964a4'/%3E%3Ctext x='300' y='310' fill='white' text-anchor='middle' font-size='46'%3ECarátula actual%3C/text%3E%3C/svg%3E" };
  if (command === "audio_write_tags") { writes.push(payload?.request); return; }
  if (command === "audio_batch_write_tags") { writes.push(...payload?.requests as unknown[]); return []; }
  if (command === "music_library_download_cover") return cover;
  return null;
});
function Preview() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState("");
  const [batch, setBatch] = useState(false);
  return <><button onClick={() => { writes = []; setBatch(false); setOpen(true); }}>Abrir prueba</button><button onClick={() => { writes = []; setBatch(true); setOpen(true); }}>Abrir lote</button><output>{saved}</output>
    {open ? <TagEditorModal isOpen paths={batch ? ["song.flac", "empty.mp3"] : ["song.flac"]} onClose={() => { setSaved(writeEvidence()); setOpen(false); }} onSaved={() => setSaved(writeEvidence())} /> : null}
  </>;
}
createRoot(document.getElementById("root")!).render(<Preview />);

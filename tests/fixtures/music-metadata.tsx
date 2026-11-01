import { useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { BatchMetadataModal } from "../../src/features/music_library/ui/BatchMetadataModal";
import "../../src/app/styles.css";

let writes: unknown[] = [];
mockIPC(async (command, payload) => {
  if (command === "music_library_search_metadata") {
    if (String(payload?.query).includes("Error")) throw new Error("Catálogo no disponible");
    if (String(payload?.query).includes("Vacío")) return [];
    await new Promise(resolve => setTimeout(resolve, 500));
    return [{ title: "Canción verificada", artist: "Artista verificado", album: "Álbum de estudio", coverUrl: "", source: payload?.deezer ? "Deezer" : "Apple Music" }];
  }
  if (command === "audio_read_tags") return { path: payload?.path, title: "Título propio", artist: null, album: null, has_artwork: false };
  if (command === "audio_write_tags") { writes.push(payload?.request); return; }
  return null;
});
function Preview() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState("");
  return <><button onClick={() => { writes = []; setOpen(true); }}>Abrir prueba</button><output>{saved}</output>
    {open ? <BatchMetadataModal folderName="Carpeta de prueba" items={[
      { path: "song.flac", title: "Artista - Canción [Video Oficial]", sourcePath: "D:/Music", relativeFolder: "" },
      { path: "empty.mp3", title: "Vacío", sourcePath: "D:/Music", relativeFolder: "" },
    ]} onClose={() => setOpen(false)} onFinished={() => setSaved(JSON.stringify(writes))} /> : null}
  </>;
}
createRoot(document.getElementById("root")!).render(<Preview />);

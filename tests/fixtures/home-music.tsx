import { useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { HomeMusicWidget } from "../../src/features/home/ui/HomeMusicWidget";
import "../../src/app/styles.css";
import "../../src/features/home/ui/home-dashboard.css";

mockIPC(() => null);
function Preview() {
  const [paused, setPaused] = useState(false);
  const [track, setTrack] = useState(0);
  const [compact, setCompact] = useState(false);
  return <><button type="button" onClick={() => setCompact(value => !value)}>Alternar vista compacta</button><main style={{ padding: 24, containerType: "inline-size", containerName: "preview-content", width: compact ? 380 : "auto", maxWidth: "100%", boxSizing: "border-box" }}>
    <header className="home-welcome"><div className="section-heading"><span className="preview-kicker">LIENZO MULTIMEDIA LOCAL</span><h1>Tu biblioteca,<br/>en un solo lugar</h1><p>Música, imágenes y vídeos de tus carpetas.</p></div>
      <HomeMusicWidget snapshot={{ path: "D:/Música/Prisma.mp3", paused, positionSeconds: 15, durationSeconds: 180, volume: 100, speed: 1, session: { family: "audio", currentIndex: track, totalItems: 3, canGoNext: true, canGoPrevious: true }, trackTitle: ["Luz de Prisma", "Órbita", "Horizonte"][track], trackArtist: "Biglex" }} onToggle={() => setPaused(value => !value)} onPrevious={() => setTrack(value => (value + 2) % 3)} onNext={() => setTrack(value => (value + 1) % 3)} />
    </header>
    <header className="home-welcome" style={{ marginTop: 20 }}><div className="section-heading"><h1>En reposo</h1></div><HomeMusicWidget /></header>
  </main></>;
}
createRoot(document.getElementById("root")!).render(<Preview />);

import type { CSSProperties } from "react";
import type { PlaybackSnapshot } from "../../playback/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { Icon } from "../../../shared/ui/Icon";

export interface HomeMusicWidgetProps {
  snapshot?: PlaybackSnapshot;
  onToggle?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function HomeMusicWidget({ snapshot, onToggle, onPrevious, onNext }: HomeMusicWidgetProps) {
  const path = snapshot?.path;
  const hasMusic = Boolean(path && (!snapshot?.session || snapshot.session.family === "audio"));
  if (!hasMusic || !path || !snapshot) return <div className="home-orbit" aria-hidden="true"><i /><i /><i /><Icon name="layout" /></div>;
  const playing = !snapshot.paused && !snapshot.eofReached;
  const parsed = parseTrackInfo(path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "");
  const title = snapshot.trackTitle?.trim() || parsed.title || "Música";
  const artist = snapshot.trackArtist?.trim() || parsed.artist || "Reproductor local";
  return <div className={`home-music-widget ${playing ? "is-playing" : "is-paused"}`} aria-label="Reproductor de Inicio">
    <div className="home-music-visualizer" aria-hidden="true">
      {Array.from({ length: 23 }, (_, index) => <i key={index} style={{ "--bar": index, "--bar-height": `${18 + ((index * 17) % 47)}px` } as CSSProperties} />)}
    </div>
    <div className="home-music-track">
      <MusicArtwork path={path} alt={title} showFallback className="home-music-cover" />
      <div><strong>{title}</strong><span>{artist}</span></div>
    </div>
    <div className="home-music-controls" aria-label="Controles de música">
      <button type="button" aria-label="Canción anterior" onClick={onPrevious} disabled={!onPrevious || snapshot.session?.canGoPrevious === false}><Icon name="chevron-left" width={19} height={19} /></button>
      <button type="button" className="home-music-toggle" aria-label={playing ? "Pausar música" : "Reanudar música"} onClick={onToggle} disabled={!onToggle}><Icon name={playing ? "pause" : "play"} width={20} height={20} /></button>
      <button type="button" aria-label="Canción siguiente" onClick={onNext} disabled={!onNext || snapshot.session?.canGoNext === false}><Icon name="chevron-right" width={19} height={19} /></button>
    </div>
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { useMusicArtwork } from "../useMusicArtwork";

interface MusicArtworkProps {
  path: string;
  alt: string;
  className: string;
}

export function MusicArtwork({ path, alt, className }: MusicArtworkProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const artwork = useMusicArtwork(path, visible);

  useEffect(() => {
    const target = containerRef.current;
    if (!target || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <span className={className} ref={containerRef}>
      {artwork ? <img alt={alt} decoding="async" loading="lazy" src={artwork} /> : null}
    </span>
  );
}

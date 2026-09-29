import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClipColor, TakeStatus, VideoTakeMarker, VideoTechnicalMetadata } from "../model/types";

export function useVideoTakes() {
  const [markers, setMarkers] = useState<Record<string, VideoTakeMarker>>({});
  const [loading, setLoading] = useState(false);

  const loadMarkers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoke<Record<string, VideoTakeMarker>>("video_list_take_markers");
      setMarkers(res || {});
    } catch (err) {
      console.error("Error al cargar marcadores de tomas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  const setTakeMarker = useCallback(
    async (
      path: string,
      status: TakeStatus,
      clipColor?: ClipColor | null,
      rating?: number | null,
      note?: string | null
    ) => {
      try {
        const marker = await invoke<VideoTakeMarker>("video_set_take_marker", {
          path,
          status,
          clipColor: clipColor || "none",
          rating: rating ?? null,
          note: note ?? null,
        });

        const key = path.replace(/\//g, "\\").toLowerCase();
        setMarkers((prev) => {
          if (status === "pending" && (!clipColor || clipColor === "none") && !rating && !note) {
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return { ...prev, [key]: marker };
        });

        return marker;
      } catch (err) {
        console.error("Error al asignar marcador de toma:", err);
        throw err;
      }
    },
    []
  );

  const getMarkerForPath = useCallback(
    (path?: string | null): VideoTakeMarker | undefined => {
      if (!path) return undefined;
      const key = path.replace(/\//g, "\\").toLowerCase();
      return markers[key];
    },
    [markers]
  );

  return {
    markers,
    loading,
    refreshMarkers: loadMarkers,
    setTakeMarker,
    getMarkerForPath,
  };
}

export function useVideoTechnicalMetadata(videoPath?: string | null) {
  const [metadata, setMetadata] = useState<VideoTechnicalMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoPath) {
      setMetadata(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    invoke<VideoTechnicalMetadata>("video_get_technical_metadata", { path: videoPath })
      .then((data) => {
        if (isMounted) {
          setMetadata(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [videoPath]);

  return { metadata, loading, error };
}

import { useEffect, useRef } from "react";
import type { DspConfig } from "../../dsp/model/types";
import { EQ_FREQUENCIES } from "../../dsp/model/types";

const STORAGE_KEY_CONFIG = "prisma_dsp_config";
const STORAGE_KEY_ENABLED = "prisma_dsp_enabled";

interface DspNodes {
  audioCtx: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
  preampNode: GainNode;
  eqNodes: BiquadFilterNode[];
  bassMainNode: BiquadFilterNode;
  bassSubNode: BiquadFilterNode;
  clarityAirNode: BiquadFilterNode;
  clarityPresenceNode: BiquadFilterNode;
  compressorNode: DynamicsCompressorNode;
}

/**
 * Hook que conecta el elemento <video> HTML5 del reproductor de Prisma
 * directamente a un motor de procesamiento Web Audio API de alta fidelidad.
 * Sincroniza en tiempo real con el ecualizador, presets, bass boost y bypass.
 */
export function useVideoAudioDsp(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const dspNodesRef = useRef<DspNodes | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Solo crear la cadena Web Audio una vez para este elemento <video>
    if (!dspNodesRef.current) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        const sourceNode = audioCtx.createMediaElementSource(video);

        // 1. Ganancia Maestro / Preamp
        const preampNode = audioCtx.createGain();

        // 2. 10 Bandas Paramétricas de Ecualización (Direct Form Biquad)
        const eqNodes: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq) => {
          const node = audioCtx.createBiquadFilter();
          node.type = "peaking";
          node.frequency.value = freq;
          node.Q.value = 1.527;
          node.gain.value = 0;
          return node;
        });

        // 3. HyperBass Acústico (90 Hz con Q=2.5 y 55 Hz con Q=2.2)
        const bassMainNode = audioCtx.createBiquadFilter();
        bassMainNode.type = "peaking";
        bassMainNode.frequency.value = 90;
        bassMainNode.Q.value = 2.5;
        bassMainNode.gain.value = 0;

        const bassSubNode = audioCtx.createBiquadFilter();
        bassSubNode.type = "peaking";
        bassSubNode.frequency.value = 55;
        bassSubNode.Q.value = 2.2;
        bassSubNode.gain.value = 0;

        // 4. Claridad y Aire / Aural Exciter (Highshelf 7500 Hz y Presencia 3500 Hz)
        const clarityAirNode = audioCtx.createBiquadFilter();
        clarityAirNode.type = "highshelf";
        clarityAirNode.frequency.value = 7500;
        clarityAirNode.gain.value = 0;

        const clarityPresenceNode = audioCtx.createBiquadFilter();
        clarityPresenceNode.type = "peaking";
        clarityPresenceNode.frequency.value = 3500;
        clarityPresenceNode.Q.value = 1.2;
        clarityPresenceNode.gain.value = 0;

        // 5. Dynamic Boost / Limiter de salida suave
        const compressorNode = audioCtx.createDynamicsCompressor();
        compressorNode.threshold.value = -8;
        compressorNode.knee.value = 2.8;
        compressorNode.ratio.value = 2.0;
        compressorNode.attack.value = 0.008;
        compressorNode.release.value = 0.07;

        // Interconexión en cascada:
        // Source -> Preamp -> EQ[0..9] -> Claridad -> Bass -> Compresor -> Salida física
        let current: AudioNode = sourceNode;
        current.connect(preampNode);
        current = preampNode;

        for (const eqNode of eqNodes) {
          current.connect(eqNode);
          current = eqNode;
        }

        current.connect(clarityAirNode);
        current = clarityAirNode;
        current.connect(clarityPresenceNode);
        current = clarityPresenceNode;

        current.connect(bassMainNode);
        current = bassMainNode;
        current.connect(bassSubNode);
        current = bassSubNode;

        current.connect(compressorNode);
        current = compressorNode;

        current.connect(audioCtx.destination);

        dspNodesRef.current = {
          audioCtx,
          sourceNode,
          preampNode,
          eqNodes,
          bassMainNode,
          bassSubNode,
          clarityAirNode,
          clarityPresenceNode,
          compressorNode,
        };

        // Reanudar contexto si el navegador lo suspende por políticas de autoplay
        const resumeAudio = () => {
          if (audioCtx.state === "suspended") {
            void audioCtx.resume();
          }
        };
        video.addEventListener("play", resumeAudio);
        video.addEventListener("playing", resumeAudio);
      } catch (err) {
        console.warn("[Prisma Video DSP] No se pudo inicializar Web Audio:", err);
      }
    }

    const applyConfig = (cfg: DspConfig | null) => {
      const nodes = dspNodesRef.current;
      if (!nodes) return;

      if (!cfg || !cfg.enabled) {
        // BYPASS: Restablecer todos los nodos a plano (cero alteración)
        nodes.preampNode.gain.value = 1.0;
        nodes.eqNodes.forEach((node) => {
          node.gain.value = 0;
        });
        nodes.bassMainNode.gain.value = 0;
        nodes.bassSubNode.gain.value = 0;
        nodes.clarityAirNode.gain.value = 0;
        nodes.clarityPresenceNode.gain.value = 0;
        nodes.compressorNode.threshold.value = 0;
        return;
      }

      // 1. Preamp
      const pLinear = Math.pow(10, (cfg.preampDb || 0) / 20);
      nodes.preampNode.gain.value = pLinear;

      // 2. Bandas de Ecualización
      if (cfg.bands) {
        cfg.bands.forEach((b, idx) => {
          if (nodes.eqNodes[idx]) {
            nodes.eqNodes[idx].gain.value = b.gainDb;
          }
        });
      }

      // 3. Refuerzo de Graves (HyperBass centrado)
      const bassVal = Math.max(0, Math.min(10, cfg.effects?.bassBoost ?? 0));
      nodes.bassMainNode.gain.value = bassVal * 0.9;
      nodes.bassSubNode.gain.value = bassVal * 0.65;

      // 4. Claridad y Fidelidad Armónica
      const clarityVal = Math.max(0, Math.min(10, cfg.effects?.clarity ?? 0));
      nodes.clarityAirNode.gain.value = clarityVal * 0.45;
      nodes.clarityPresenceNode.gain.value = clarityVal * 0.3;

      // 5. Dynamic Boost
      const dynVal = Math.max(0, Math.min(10, cfg.effects?.dynamicBoost ?? 0));
      if (dynVal > 0.01) {
        nodes.compressorNode.threshold.value = -8 - dynVal * 0.8;
        nodes.compressorNode.ratio.value = 1.3 + dynVal * 0.12;
      } else {
        nodes.compressorNode.threshold.value = 0;
      }
    };

    // Cargar configuración guardada al montar el reproductor
    try {
      const isEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) === "true";
      const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        applyConfig({
          enabled: isEnabled,
          preampDb: parsed.preampDb ?? 0,
          bands: (parsed.bands ?? []).map((gainDb: number, idx: number) => ({
            freq: (parsed.frequencies && parsed.frequencies[idx]) ?? EQ_FREQUENCIES[idx],
            gainDb,
          })),
          effects: parsed.effects ?? {
            clarity: 4,
            ambience: 3,
            surround: 3,
            dynamicBoost: 2,
            bassBoost: 3,
          },
        });
      }
    } catch {}

    // Escuchar eventos en tiempo real desde el ecualizador
    const handleDspChange = (e: Event) => {
      const customEvent = e as CustomEvent<DspConfig>;
      if (customEvent.detail) {
        applyConfig(customEvent.detail);
      }
    };

    window.addEventListener("prisma-dsp-change", handleDspChange);
    return () => {
      window.removeEventListener("prisma-dsp-change", handleDspChange);
    };
  }, [videoRef]);
}

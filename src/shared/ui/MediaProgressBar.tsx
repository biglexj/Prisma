import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSystemSettings, type ProgressBarStyle } from "../../app/useSystemSettings";
import { dispatchProgressRender, type RenderContext, type RenderState } from "./progressRenderers";
import "./media-progress-bar.css";

export interface MediaProgressBarProps {
  position: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  styleMode?: ProgressBarStyle;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  className?: string;
  ariaLabel?: string;
}

export function MediaProgressBar({
  position,
  duration,
  isPlaying,
  onSeek,
  disabled = false,
  styleMode,
  activeColor,
  inactiveColor,
  thumbColor,
  className = "",
  ariaLabel = "Posición de reproducción",
}: MediaProgressBarProps) {
  const { progressBarStyle: globalStyle } = useSystemSettings();
  const effectiveMode: ProgressBarStyle = styleMode ?? globalStyle ?? "wavy";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const safeDuration = Math.max(duration || 0, 0.001);
  const actualProgress = Math.min(Math.max((position || 0) / safeDuration, 0), 1);
  const currentProgress = isDragging ? dragProgress : actualProgress;

  // Referencias para que el bucle de animación sea continuo e ininterrumpido
  const progressRef = useRef(currentProgress);
  progressRef.current = currentProgress;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const activeColorRef = useRef(activeColor);
  activeColorRef.current = activeColor;

  const inactiveColorRef = useRef(inactiveColor);
  inactiveColorRef.current = inactiveColor;

  const thumbColorRef = useRef(thumbColor);
  thumbColorRef.current = thumbColor;

  // Estado continuo del motor físico / matemático
  const animStateRef = useRef<RenderState>({
    phase: 0,
    lastTime: performance.now(),
    currentAmp: isPlaying ? 3 : 0,
    particles: [],
    fluidVelocity: 0,
    lastProgressX: 0,
    elasticAmp: 0,
    elasticPhase: 0,
  });

  // Renderizado continuo en Canvas a 60/120 FPS
  useEffect(() => {
    if (effectiveMode === "classic") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number | null = null;
    animStateRef.current.lastTime = performance.now();

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height || 28;

      if (width <= 0 || height <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(width * dpr);
      const displayHeight = Math.floor(height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      const now = performance.now();
      const delta = Math.min((now - animStateRef.current.lastTime) / 1000, 0.1);
      animStateRef.current.lastTime = now;

      // Calcular avance de fase continua
      const playing = isPlayingRef.current && !disabledRef.current;
      if (playing) {
        animStateRef.current.phase = (animStateRef.current.phase + delta * ((2 * Math.PI) / 1.8)) % (2 * Math.PI);
      }

      // Transición suave de amplitud al pausar / reanudar
      const targetAmp = playing ? 3.0 : 0;
      animStateRef.current.currentAmp += (targetAmp - animStateRef.current.currentAmp) * Math.min(delta * 10, 1);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const prog = progressRef.current;
      const progressX = Math.min(Math.max(prog * width, 0), width);

      // Calcular velocidad de fluido para estilo fluid
      const vel = (progressX - animStateRef.current.lastProgressX) / Math.max(delta, 0.001);
      animStateRef.current.fluidVelocity = animStateRef.current.fluidVelocity * 0.85 + vel * 0.15;
      animStateRef.current.lastProgressX = progressX;

      // Actualizar física de cuerda elástica
      animStateRef.current.elasticAmp *= Math.exp(-delta * 4);
      animStateRef.current.elasticPhase += delta * 24;

      // Obtener colores del contenedor o props
      const computedStyles = getComputedStyle(container);
      const resolvedPrimary = activeColorRef.current || computedStyles.getPropertyValue("--primary").trim() || "#e06b9b";
      const resolvedTrack = inactiveColorRef.current || computedStyles.getPropertyValue("--outline-variant").trim() || "rgba(255, 255, 255, 0.2)";
      const resolvedThumb = thumbColorRef.current || "#ffffff";

      const renderCtx: RenderContext = {
        ctx,
        width,
        height,
        centerY,
        progressX,
        progress: prog,
        isPlaying: playing,
        isDragging: isDraggingRef.current,
        delta,
        state: animStateRef.current,
        primaryColor: resolvedPrimary,
        trackColor: resolvedTrack,
        thumbColor: resolvedThumb,
      };

      dispatchProgressRender(effectiveMode, renderCtx);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectiveMode]);

  // Manejador de cálculo de posición a partir de evento de puntero
  const computeProgressFromEvent = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const offsetX = e.clientX - rect.left;
    return Math.min(Math.max(offsetX / rect.width, 0), 1);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar si falla la captura de puntero
    }
    const newProgress = computeProgressFromEvent(e);
    setIsDragging(true);
    setDragProgress(newProgress);
    animStateRef.current.elasticAmp = 8; // Pulsar cuerda elástica
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled || duration <= 0) return;
    const newProgress = computeProgressFromEvent(e);
    setDragProgress(newProgress);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignorar
    }
    const newProgress = computeProgressFromEvent(e);
    setIsDragging(false);
    onSeek(newProgress * duration);
    animStateRef.current.elasticAmp = 6;
  };

  const handlePointerEnter = () => {
    if (effectiveMode === "elastic_string") {
      animStateRef.current.elasticAmp = 5; // Vibración al pasar el cursor
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const step = 5; // 5 segundos de salto
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onSeek(Math.max((position || 0) - step, 0));
      animStateRef.current.elasticAmp = 6;
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onSeek(Math.min((position || 0) + step, duration));
      animStateRef.current.elasticAmp = 6;
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(duration);
    }
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(isDragging ? dragProgress * duration : position)}
      aria-disabled={disabled}
      className={`media-progress-bar-root is-${effectiveMode} ${
        isDragging ? "is-dragging" : ""
      } ${disabled ? "is-disabled" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onKeyDown={handleKeyDown}
    >
      {effectiveMode === "classic" ? (
        <div className="media-progress-classic-track">
          <div
            className="media-progress-classic-fill"
            style={{
              width: `${currentProgress * 100}%`,
              backgroundColor: activeColor || undefined,
            }}
          />
          <div
            className="media-progress-classic-thumb"
            style={{
              left: `${currentProgress * 100}%`,
              backgroundColor: thumbColor || undefined,
            }}
          />
        </div>
      ) : (
        <canvas ref={canvasRef} className="media-progress-canvas" />
      )}
    </div>
  );
}

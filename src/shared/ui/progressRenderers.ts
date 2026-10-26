import type { ProgressBarStyle } from "../../app/useSystemSettings";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/** Célula de la matriz binaria: dígito 0/1 y temporizador de refresco. */
export interface BinaryCell {
  val: "0" | "1";
  updateTimer: number;
}

/** Partícula de fuego cinético: sube, mengua y se apaga. */
export interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

export interface RenderState {
  phase: number;
  /** Segundos de animación activa, sin reinicios de fase; se congela al pausar. */
  animationTime: number;
  lastTime: number;
  currentAmp: number;
  particles: Particle[];
  fluidVelocity: number;
  lastProgressX: number;
  elasticAmp: number;
  elasticPhase: number;
  /** Matriz de dígitos del estilo binario. */
  binaryMatrix: BinaryCell[];
  /** Columnas con las que se creó la matriz binaria (para detectar cambios de ancho). */
  binaryColumns: number;
  /** Partículas de llama del estilo de fuego cinético. */
  fireParticles: FireParticle[];
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerY: number;
  progressX: number;
  progress: number;
  isPlaying: boolean;
  isDragging: boolean;
  delta: number;
  state: RenderState;
  primaryColor: string;
  secondaryColor: string;
  trackColor: string;
  thumbColor: string;
}

/**
 * 1. ONDULADA (Wavy) - Onda senoidal suave con flujo armónico continuo
 */
export function renderWavy(rc: RenderContext) {
  const { ctx, width, centerY, progressX, state, primaryColor, trackColor, thumbColor } = rc;

  const strokeWidth = 4;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const wavelength = 32;
  const currentAmp = state.currentAmp;

  // 1. Lado Inactivo (derecha): Ondulación sutil que se desvanece suavemente hacia la línea recta (estilo Supergalería)
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;

    if (currentAmp > 0.1) {
      const fadeDistance = 48; // distancia de desvanecimiento suave de la onda inactiva
      const fadeEnd = Math.min(progressX + fadeDistance, width);
      const baseWaveAmp = currentAmp * 0.45; // ondulación sutil

      ctx.moveTo(progressX, centerY);
      for (let x = progressX; x <= fadeEnd; x += 1.5) {
        const fadeFactor = 1 - (x - progressX) / fadeDistance;
        const angle = (x / wavelength) * (2 * Math.PI) - state.phase;
        const y = centerY + Math.sin(angle) * baseWaveAmp * fadeFactor;
        ctx.lineTo(x, y);
      }
      if (fadeEnd < width) {
        ctx.lineTo(width, centerY);
      }
    } else {
      ctx.moveTo(progressX, centerY);
      ctx.lineTo(width, centerY);
    }
    ctx.stroke();
  }

  // 2. Lado Activo (izquierda): Onda continua con color primario
  if (progressX > 0) {
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;

    ctx.moveTo(0, centerY);

    const step = 1.5;
    for (let x = 0; x <= progressX; x += step) {
      const startDamping = Math.min(x / 14, 1);
      const endDamping = Math.min((progressX - x) / 10, 1);
      const envelope = Math.min(startDamping, endDamping);

      const angle = (x / wavelength) * (2 * Math.PI) - state.phase;
      const y = centerY + Math.sin(angle) * currentAmp * envelope;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(progressX, centerY);
    ctx.stroke();
  }

  // 3. Thumb / Indicador vertical
  drawCapsuleThumb(ctx, progressX, centerY, 4.5, 16, 2.25, thumbColor, width);
}

/**
 * 2. HAZ PRISMÁTICO (Prism) - Dispersión espectral iridiscente y destellos ópticos
 */
export function renderPrism(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, trackColor } = rc;

  const strokeWidth = 5;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";

  // Inactivo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo: Gradiente de dispersión espectral
  if (progressX > 0) {
    const grad = ctx.createLinearGradient(0, 0, Math.max(progressX, 1), 0);
    grad.addColorStop(0.0, "#ff453a"); // Rojo
    grad.addColorStop(0.2, "#ff9f0a"); // Naranja
    grad.addColorStop(0.4, "#ffd60a"); // Amarillo
    grad.addColorStop(0.6, "#30d158"); // Verde
    grad.addColorStop(0.8, "#64d2ff"); // Cian
    grad.addColorStop(1.0, "#bf5af2"); // Violeta

    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.moveTo(0, centerY);
    ctx.lineTo(progressX, centerY);
    ctx.stroke();

    // Destello cáustico animado si se está reproduciendo
    if (isPlaying && progressX > 20) {
      const shimmerPos = ((Math.sin(state.phase * 1.2) * 0.5 + 0.5) * progressX);
      const flareGrad = ctx.createRadialGradient(shimmerPos, centerY, 0, shimmerPos, centerY, 14);
      flareGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      flareGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
      flareGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(shimmerPos, centerY, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Thumb: Prisma / Diamante facetado brillante
  const thumbX = Math.min(Math.max(progressX, 8), width - 8);
  ctx.save();
  ctx.shadowColor = "rgba(191, 90, 242, 0.6)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(thumbX, centerY - 8.5);
  ctx.lineTo(thumbX + 5.5, centerY);
  ctx.lineTo(thumbX, centerY + 8.5);
  ctx.lineTo(thumbX - 5.5, centerY);
  ctx.closePath();
  ctx.fill();

  // Núcleo reflectante interno
  ctx.fillStyle = "#64d2ff";
  ctx.beginPath();
  ctx.arc(thumbX, centerY, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 3. ESPECTRO SOUNDWAVE (Soundwave) - Micro-barras de audio verticales
 *
 * Referencia: barras centradas, modulación de ruido suave y lenta y halo
 * luminoso en la barra justo antes del cabezal de reproducción.
 */
export function renderSoundwave(rc: RenderContext) {
  const { ctx, width, height, centerY, progressX, isPlaying, state, primaryColor, trackColor, thumbColor } = rc;

  const barWidth = 4;
  const gap = 3;
  const numBars = Math.floor(width / (barWidth + gap));
  const totalWidth = numBars * (barWidth + gap);
  const startX = (width - totalWidth) / 2;
  const time = state.animationTime;

  for (let i = 0; i < numBars; i++) {
    const x = startX + i * (barWidth + gap);
    const isActive = x <= progressX;

    let barHeight = 4;
    if (isActive) {
      if (isPlaying) {
        const noise = Math.sin(i * 0.3 + time * 1.5) + Math.cos(i * 0.17 - time * 1.1);
        barHeight = Math.max(4, Math.abs(noise) * (height * 0.55));
      } else {
        barHeight = 6;
      }
    } else {
      barHeight = 4;
    }

    ctx.fillStyle = isActive ? primaryColor : trackColor;
    if (isActive && Math.abs(progressX - x) < 20) {
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Thumb: Marcador vertical luminoso
  drawCapsuleThumb(ctx, progressX, centerY, 4, 18, 2, thumbColor, width);
}

/**
 * 4. MERCURIO LÍQUIDO (Fluid) - Gota viscosa elástica con deformación dinámica
 */
export function renderFluid(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, trackColor, thumbColor } = rc;

  // Inactivo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo: Tubo líquido continuo con pulsación orgánica
  if (progressX > 0) {
    ctx.save();
    ctx.strokeStyle = primaryColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    for (let x = 0; x <= progressX; x += 3) {
      const pulse = isPlaying ? Math.sin(x / 20 - state.phase * 2) * 1.2 : 0;
      ctx.lineTo(x, centerY + pulse);
    }
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  // Thumb: Gota con efecto elástico de estiramiento según velocidad e inercia
  const vel = Math.abs(state.fluidVelocity);
  const breath = isPlaying ? Math.sin(state.phase * 3) * 0.15 : 0;
  const scaleX = 1 + Math.min(vel * 0.04, 0.7) + breath;
  const scaleY = 1 / Math.sqrt(Math.max(scaleX, 0.5));

  const radius = 6.5;
  const rx = radius * scaleX;
  const ry = radius * scaleY;
  const thumbX = Math.min(Math.max(progressX, rx), width - rx);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 5;
  ctx.fillStyle = thumbColor;
  ctx.beginPath();
  ctx.ellipse(thumbX, centerY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Reflejo líquido brillante superior
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  ctx.arc(thumbX - 1.5, centerY - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 5. DOBLE HÉLICE CUÁNTICA (Helix) - Dos ondas entrelazadas en contrafase 3D
 */
export function renderHelix(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, secondaryColor, trackColor, thumbColor } = rc;

  // Inactivo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo: Dos cadenas entrelazadas
  if (progressX > 0) {
    const wavelength = 36;
    const maxAmp = 6.5 * (isPlaying ? 1 : 0.4);

    // Peldaños de enlace cuántico cada 14px
    ctx.strokeStyle = `color-mix(in srgb, ${secondaryColor} 40%, transparent)`;
    ctx.lineWidth = 1.5;
    for (let x = 6; x <= progressX - 4; x += 14) {
      const angle = (x / wavelength) * (2 * Math.PI) - state.phase;
      const y1 = centerY + Math.sin(angle) * maxAmp;
      const y2 = centerY + Math.sin(angle + Math.PI) * maxAmp;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }

    // Hebra 1 (Primaria)
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.moveTo(0, centerY);
    for (let x = 0; x <= progressX; x += 1.5) {
      const angle = (x / wavelength) * (2 * Math.PI) - state.phase;
      const y = centerY + Math.sin(angle) * maxAmp;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Hebra 2 (Variante secundaria del tema / Contrafase)
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.strokeStyle = secondaryColor;
    ctx.moveTo(0, centerY);
    for (let x = 0; x <= progressX; x += 1.5) {
      const angle = (x / wavelength) * (2 * Math.PI) - state.phase + Math.PI;
      const y = centerY + Math.sin(angle) * maxAmp;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Thumb: Esfera de núcleo cuántico
  const thumbX = Math.min(Math.max(progressX, 5), width - 5);
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 7;
  ctx.fillStyle = thumbColor;
  ctx.beginPath();
  ctx.arc(thumbX, centerY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 6. PULSO BIO-SENSOR ECG (Neon Pulse) - Electrocardiograma neón
 */
export function renderNeonPulse(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, trackColor, thumbColor } = rc;

  // Inactivo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo: Trazado ECG con onda QRS viajera
  if (progressX > 0) {
    ctx.save();
    ctx.strokeStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(0, centerY);

    const pulseLen = 50;
    const pulsePos = isPlaying
      ? (state.phase / (2 * Math.PI)) * Math.max(progressX, 1)
      : progressX * 0.7;

    for (let x = 0; x <= progressX; x += 2) {
      const dist = x - pulsePos;
      let y = centerY;

      if (Math.abs(dist) < pulseLen / 2) {
        const norm = dist / (pulseLen / 2);
        // Función sintética de pulso P-QRS-T
        if (norm > -0.7 && norm < -0.4) {
          y -= 2.5 * Math.sin(((norm + 0.55) / 0.15) * Math.PI); // P
        } else if (norm >= -0.2 && norm < -0.08) {
          y += 3.5; // Q
        } else if (norm >= -0.08 && norm <= 0.08) {
          y -= 10.5 * (1 - Math.abs(norm / 0.08)); // R (pico central)
        } else if (norm > 0.08 && norm <= 0.2) {
          y += 4.5; // S
        } else if (norm > 0.35 && norm < 0.7) {
          y -= 3.0 * Math.sin(((norm - 0.525) / 0.175) * Math.PI); // T
        }
      }

      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  // Thumb
  drawCapsuleThumb(ctx, progressX, centerY, 4.5, 16, 2.25, thumbColor, width, "#00f0ff");
}

/**
 * 7. ESTELA CÓSMICA (Particles) - Núcleo estelar emisor de partículas vivas
 *
 * Referencia: pista oscura, núcleo con degradado luminoso, partículas que
 * quedan atrás del cabezal y cabeza de cometa blanca con halo.
 */
export function renderParticles(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, delta, primaryColor, thumbColor } = rc;

  // Pista oscura y delgada
  ctx.fillStyle = "rgba(30, 41, 59, 0.55)";
  ctx.beginPath();
  ctx.roundRect(0, centerY - 2, width, 4, 2);
  ctx.fill();

  // Núcleo con degradado desde el origen hasta el cabezal
  if (progressX > 0) {
    const grad = ctx.createLinearGradient(0, 0, progressX, 0);
    grad.addColorStop(0, "rgba(245, 158, 11, 0)");
    grad.addColorStop(1, primaryColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, centerY - 2, progressX, 4, 2);
    ctx.fill();
  }

  // Emisión de partículas en la cabeza del cometa
  if (isPlaying && progressX > 0 && progressX < width && state.particles.length < 48) {
    if (Math.random() > 0.28) {
      state.particles.push({
        x: progressX,
        y: centerY + (Math.random() - 0.5) * 4,
        vx: -(Math.random() * 30 + 12 + Math.abs(state.fluidVelocity) * 14),
        vy: (Math.random() - 0.5) * 9,
        life: 0,
        maxLife: Math.random() * 0.8 + 0.4,
        size: Math.random() * 2.4 + 1,
        color: Math.random() > 0.55 ? "#f59e0b" : Math.random() > 0.4 ? "#ec4899" : "#ffffff",
      });
    }
  }

  // Actualizar y dibujar partículas vivas
  ctx.save();
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += delta;
    if (p.life >= p.maxLife || p.x < 0) {
      state.particles.splice(i, 1);
      continue;
    }

    p.x += p.vx * delta;
    p.y += p.vy * delta;

    const alpha = Math.max(1 - p.life / p.maxLife, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  // Cabeza de cometa
  const thumbX = Math.min(Math.max(progressX, 6), width - 6);
  ctx.save();
  ctx.shadowColor = "#fef3c7";
  ctx.shadowBlur = 18;
  ctx.fillStyle = thumbColor;
  ctx.beginPath();
  ctx.arc(thumbX, centerY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 8. CINTA ANALÓGICA & VINILO (Vinyl Tape) - Textura de cinta magnética y surcos
 */
export function renderVinylTape(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, trackColor } = rc;

  const tapeHeight = 8;
  const tapeY = centerY - tapeHeight / 2;

  // Inactivo: Guía de cinta vacía
  if (progressX < width) {
    ctx.fillStyle = trackColor;
    ctx.beginPath();
    ctx.roundRect(progressX, tapeY + 2, width - progressX, 4, 2);
    ctx.fill();
  }

  // Activo: Cinta magnética con líneas de textura
  if (progressX > 0) {
    ctx.save();
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.roundRect(0, tapeY, progressX, tapeHeight, 2);
    ctx.fill();

    // Microsurcos longitudinales
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, tapeY + 2.5);
    ctx.lineTo(progressX, tapeY + 2.5);
    ctx.moveTo(0, tapeY + 5.5);
    ctx.lineTo(progressX, tapeY + 5.5);
    ctx.stroke();

    // Marcas de índice magnético en movimiento
    if (isPlaying) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      const offset = (state.phase * 6) % 18;
      for (let x = offset; x < progressX - 3; x += 18) {
        ctx.fillRect(x, tapeY + 1, 2, tapeHeight - 2);
      }
    }
    ctx.restore();
  }

  // Thumb: Cabezal de reproducción de aluminio pulido con punto rubí
  const thumbWidth = 6.5;
  const thumbHeight = 18;
  const thumbX = Math.min(Math.max(progressX - thumbWidth / 2, 0), width - thumbWidth);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#e1e4e8";
  ctx.beginPath();
  ctx.roundRect(thumbX, centerY - thumbHeight / 2, thumbWidth, thumbHeight, 2);
  ctx.fill();

  // Joya rubí central del cabezal
  ctx.fillStyle = "#ff3b30";
  ctx.beginPath();
  ctx.arc(thumbX + thumbWidth / 2, centerY, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 9. CUERDA ELÁSTICA TENSADA (Elastic String) - Oscilador armónico acústico
 */
export function renderElasticString(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, trackColor, thumbColor } = rc;

  // Inactivo: Cuerda en reposo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo: Cuerda armónica vibrante
  if (progressX > 0) {
    const continuousVib = isPlaying ? Math.sin(state.phase * 5) * 2.8 : 0;
    const amp = state.elasticAmp + continuousVib;

    // Estela de vibración acústica semi-transparente
    if (Math.abs(amp) > 0.4) {
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x <= progressX; x += 3) {
        const curve = Math.sin((x / Math.max(progressX, 1)) * Math.PI) * amp;
        ctx.lineTo(x, centerY + curve);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x <= progressX; x += 3) {
        const curve = -Math.sin((x / Math.max(progressX, 1)) * Math.PI) * amp;
        ctx.lineTo(x, centerY + curve);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Cuerda central
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.moveTo(0, centerY);

    const currentVib = Math.sin(state.elasticPhase) * amp;
    for (let x = 0; x <= progressX; x += 2) {
      const curve = Math.sin((x / Math.max(progressX, 1)) * Math.PI) * currentVib;
      ctx.lineTo(x, centerY + curve);
    }
    ctx.stroke();
  }

  // Thumb: Plectro / Cejuela acústica
  drawCapsuleThumb(ctx, progressX, centerY, 5, 17, 2.5, thumbColor, width);
}

/**
 * 10. CLÁSICA (Classic) - Barra continua lineal elegante
 */
export function renderClassic(rc: RenderContext) {
  const { ctx, width, centerY, progressX, primaryColor, trackColor, thumbColor } = rc;

  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  // Inactivo
  if (progressX < width) {
    ctx.beginPath();
    ctx.strokeStyle = trackColor;
    ctx.moveTo(progressX, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Activo
  if (progressX > 0) {
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.moveTo(0, centerY);
    ctx.lineTo(progressX, centerY);
    ctx.stroke();
  }

  // Thumb
  drawCapsuleThumb(ctx, progressX, centerY, 4.5, 16, 2.25, thumbColor, width);
}

/**
 * 11. MATRIZ BINARIA (Binary) - Dígitos 0/1 que se descifran hacia el cabezal
 */
export function renderBinary(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, delta } = rc;

  const charWidth = 10;
  const columns = Math.max(1, Math.ceil(width / charWidth));

  // Inicializar o redimensionar la matriz de dígitos
  if (state.binaryMatrix.length !== columns) {
    state.binaryMatrix = Array.from({ length: columns }, () => ({
      val: (Math.random() > 0.5 ? "1" : "0") as "0" | "1",
      updateTimer: Math.random() * 60,
    }));
    state.binaryColumns = columns;
  }

  // Contenedor oscuro
  ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
  ctx.beginPath();
  ctx.roundRect(0, centerY - 12, width, 24, 5);
  ctx.fill();

  ctx.save();
  ctx.font = "bold 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < state.binaryMatrix.length; i++) {
    const cell = state.binaryMatrix[i];
    const x = i * charWidth + charWidth / 2;
    if (x > width) break;

    const isActive = x <= progressX;

    // Refresco aleatorio de dígitos (más rápido cerca del cabezal)
    if (isPlaying) {
      cell.updateTimer -= delta * 60;
      if (cell.updateTimer <= 0) {
        cell.val = Math.random() > 0.5 ? "1" : "0";
        const distance = Math.abs(progressX - x);
        cell.updateTimer = distance < 50 ? Math.random() * 5 + 2 : Math.random() * 30 + 10;
      }
    }

    if (isActive) {
      const nearHead = Math.abs(progressX - x) < 20;
      ctx.fillStyle = nearHead ? "#ffffff" : "#22c55e";
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = nearHead ? 10 : 0;
    } else {
      ctx.fillStyle = "rgba(55, 65, 81, 0.9)";
      ctx.shadowBlur = 0;
    }

    ctx.fillText(cell.val, x, centerY);
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  // Lector de escaneo
  if (progressX > 0 && progressX < width) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(progressX, centerY - 13);
    ctx.lineTo(progressX, centerY + 13);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 12. LABERINTO PAC-MAN (Pacman) - Personaje que devora la pista punto a punto
 */
export function renderPacman(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state } = rc;

  const pacSize = 10;

  // Fondo del laberinto
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(0, centerY - 11, width, 22);

  // Bordes azules
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, centerY - 10);
  ctx.lineTo(width, centerY - 10);
  ctx.moveTo(0, centerY + 10);
  ctx.lineTo(width, centerY + 10);
  ctx.stroke();

  // Puntos pendientes de devorar
  ctx.fillStyle = "#fef08a";
  for (let x = 15; x < width; x += 18) {
    if (x > progressX + pacSize) {
      ctx.beginPath();
      ctx.arc(x, centerY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Píldora final
  if (width - 15 > progressX + pacSize) {
    ctx.save();
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(width - 15, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Personaje con la boca abriendo y cerrando
  const mouthAngle = isPlaying
    ? (Math.sin(state.animationTime * (2 * Math.PI / 0.6)) + 1) / 2 * (Math.PI / 4)
    : Math.PI / 8;

  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  ctx.arc(progressX, centerY, pacSize, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.lineTo(progressX, centerY);
  ctx.closePath();
  ctx.fill();
}

/**
 * 13. CIBER-GLITCH (Glitch) - Canales RGB desfasados con artefactos
 */
export function renderGlitch(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state } = rc;

  // Pista gris
  ctx.fillStyle = "rgba(55, 65, 81, 0.9)";
  ctx.fillRect(0, centerY - 2, width, 4);

  if (progressX <= 0) return;

  // Desfase lento y continuo: sin vibración de alta frecuencia ni saltos de fase.
  const time = state.animationTime;
  const offX = Math.sin(time * 1.8) * 2;
  const offY = Math.sin(time * 1.4) * 1.1;

  // Canal cian
  ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
  ctx.fillRect(-offX, centerY - 2 - offY, progressX, 4);

  // Canal magenta
  ctx.fillStyle = "rgba(236, 72, 153, 0.8)";
  ctx.fillRect(offX, centerY - 2 + offY, progressX, 4);

  // Núcleo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, centerY - 1, progressX, 2);

  // Bloques persistentes que se desplazan suavemente en lugar de destellar.
  for (let block = 0; block < 2; block++) {
    const offset = block * Math.PI;
    const blockWidth = Math.min(18 + block * 6, progressX);
    ctx.fillStyle = block === 0 ? "rgba(6, 182, 212, 0.65)" : "rgba(236, 72, 153, 0.65)";
    ctx.fillRect(
      (Math.sin(time * 0.8 + offset) * 0.5 + 0.5) * (progressX - blockWidth),
      centerY + (block === 0 ? -6 : 5),
      blockWidth,
      2,
    );
  }

  // Cabeza estable que acompaña el desfase de los canales.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(progressX - 4 + offX, centerY - 8, 8, 16);
}

/**
 * 14. FUEGO CINÉTICO (Fire) - Llama que sube desde la cabeza de reproducción
 */
export function renderFire(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, delta } = rc;

  // Pista ámbar muy oscura
  ctx.fillStyle = "rgba(69, 26, 3, 0.9)";
  ctx.fillRect(0, centerY - 1, width, 2);

  if (progressX > 0) {
    const grad = ctx.createLinearGradient(0, 0, progressX, 0);
    grad.addColorStop(0, "#7f1d1d");
    grad.addColorStop(1, "#ef4444");
    ctx.fillStyle = grad;
    ctx.fillRect(0, centerY - 2, progressX, 4);
  }

  if (isPlaying && progressX > 0 && progressX < width && state.fireParticles.length < 90) {
    const spawn = (x: number) => {
      state.fireParticles.push({
        x: x - 5 + Math.random() * 10,
        y: centerY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * -12 - 8,
        size: Math.random() * 3 + 1.5,
        life: 1,
        color: Math.random() > 0.6 ? "#ef4444" : Math.random() > 0.3 ? "#f97316" : "#facc15",
      });
    };

    for (let i = 0; i < 3; i++) spawn(progressX);
    if (Math.random() > 0.55) spawn(Math.random() * progressX);
  }

  const shrink = Math.pow(0.93, delta * 60);
  for (let i = state.fireParticles.length - 1; i >= 0; i--) {
    const p = state.fireParticles[i];
    if (isPlaying) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta * 1.8;
      p.size *= shrink;
    }

    if (p.life <= 0 || p.size < 0.5) {
      state.fireParticles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

/**
 * 15. RAYO TESLA (Tesla) - Descarga eléctrica bifurcada hacia el cabezal
 */
export function renderTesla(rc: RenderContext) {
  const { ctx, width, centerY, progressX, state } = rc;

  // Pista oscura
  ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
  ctx.fillRect(0, centerY - 1, width, 2);

  if (progressX <= 0) return;

  for (let branch = 0; branch < 2; branch++) {
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    // Nodos estables con oscilación lenta: conserva la descarga quebrada sin
    // regenerar el rayo entero con ruido aleatorio en cada fotograma.
    for (let x = 12, node = 1; x < progressX; x += 12, node++) {
      const shape = Math.sin(node * 2.37 + branch * 1.7);
      const motion = Math.sin(state.animationTime * 1.8 + node * 1.13 + branch);
      const taper = Math.min(x / 24, (progressX - x) / 24, 1);
      ctx.lineTo(x, centerY + (shape * 4 + motion * 2) * taper);
    }
    ctx.lineTo(progressX, centerY);

    ctx.strokeStyle = branch === 0 ? "#ffffff" : "#38bdf8";
    ctx.lineWidth = branch === 0 ? 2 : 1;
    ctx.shadowColor = "#0ea5e9";
    ctx.shadowBlur = branch === 0 ? 12 : 5;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Esfera receptora
  ctx.save();
  ctx.fillStyle = "#bae6fd";
  ctx.shadowColor = "#0284c7";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(progressX, centerY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 16. SABLE LÁSER (Laser) - Hoja incandescente con empuñadura metálica
 */
export function renderLaser(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state } = rc;

  // Fondo
  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.fillRect(0, centerY - 2, width, 4);

  if (progressX <= 0) return;

  // Empuñadura
  const hiltWidth = 20;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, centerY - 5, hiltWidth, 10);
  ctx.fillStyle = "#475569";
  ctx.fillRect(5, centerY - 6, 4, 12);
  ctx.fillRect(15, centerY - 6, 2, 12);

  if (progressX <= hiltWidth) return;

  const bladeWidth = progressX - hiltWidth;

  // Resplandor exterior
  ctx.save();
  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(hiltWidth, centerY - 4, bladeWidth, 8);

  // Resplandor interior
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#fca5a5";
  ctx.fillRect(hiltWidth, centerY - 2, bladeWidth, 4);

  // Núcleo blanco con punta redondeada
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(hiltWidth, centerY - 1);
  ctx.lineTo(progressX - 3, centerY - 1);
  ctx.arc(progressX - 3, centerY, 1.5, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(hiltWidth, centerY + 1);
  ctx.closePath();
  ctx.fill();

  // Zumbido en la punta
  if (isPlaying) {
    const breath = Math.sin(state.animationTime * (2 * Math.PI / 2.8)) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + breath * 0.15})`;
    ctx.beginPath();
    ctx.arc(progressX - 1.5, centerY, 2.3 + breath * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Helper compartido para dibujar el thumb en forma de cápsula vertical
 */
function drawCapsuleThumb(
  ctx: CanvasRenderingContext2D,
  progressX: number,
  centerY: number,
  barWidth: number,
  barHeight: number,
  barRadius: number,
  thumbColor: string,
  width: number,
  glowColor?: string
) {
  const thumbX = Math.min(Math.max(progressX - barWidth / 2, 0), width - barWidth);
  const thumbY = centerY - barHeight / 2;

  ctx.save();
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;
  } else {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
  }

  ctx.fillStyle = thumbColor;
  ctx.beginPath();
  ctx.roundRect(thumbX, thumbY, barWidth, barHeight, barRadius);
  ctx.fill();
  ctx.restore();
}

/**
 * Despachador principal de estilos
 */
export function dispatchProgressRender(mode: ProgressBarStyle, rc: RenderContext) {
  switch (mode) {
    case "wavy":
      renderWavy(rc);
      break;
    case "prism":
      renderPrism(rc);
      break;
    case "soundwave":
      renderSoundwave(rc);
      break;
    case "fluid":
      renderFluid(rc);
      break;
    case "helix":
      renderHelix(rc);
      break;
    case "neon_pulse":
      renderNeonPulse(rc);
      break;
    case "particles":
      renderParticles(rc);
      break;
    case "vinyl_tape":
      renderVinylTape(rc);
      break;
    case "elastic_string":
      renderElasticString(rc);
      break;
    case "binary":
      renderBinary(rc);
      break;
    case "pacman":
      renderPacman(rc);
      break;
    case "glitch":
      renderGlitch(rc);
      break;
    case "fire":
      renderFire(rc);
      break;
    case "tesla":
      renderTesla(rc);
      break;
    case "laser":
      renderLaser(rc);
      break;
    case "classic":
    default:
      renderClassic(rc);
      break;
  }
}

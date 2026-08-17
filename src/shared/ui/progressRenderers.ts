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

export interface RenderState {
  phase: number;
  lastTime: number;
  currentAmp: number;
  particles: Particle[];
  fluidVelocity: number;
  lastProgressX: number;
  elasticAmp: number;
  elasticPhase: number;
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
 */
export function renderSoundwave(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, trackColor, thumbColor } = rc;

  const barPitch = 4.5;
  const barWidth = 2.5;
  const numBars = Math.floor(width / barPitch);

  for (let i = 0; i < numBars; i++) {
    const x = i * barPitch + barPitch / 2;
    const isActive = x <= progressX;

    let h = 4;
    if (isActive) {
      if (isPlaying) {
        const mod1 = Math.sin(i * 0.35 + state.phase * 3.5);
        const mod2 = Math.cos(i * 0.18 - state.phase * 2.2);
        const harmonic = (mod1 * mod2 * 0.5 + 0.5);
        h = 4 + harmonic * 13;
      } else {
        h = 4 + (Math.sin(i * 0.4) * 0.5 + 0.5) * 7;
      }
    } else {
      h = 3.5;
    }

    ctx.fillStyle = isActive ? primaryColor : trackColor;
    ctx.beginPath();
    ctx.roundRect(x - barWidth / 2, centerY - h / 2, barWidth, h, barWidth / 2);
    ctx.fill();
  }

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
  const { ctx, width, centerY, progressX, isPlaying, state, primaryColor, trackColor, thumbColor } = rc;

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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
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

    // Hebra 2 (Luminosa / Contrafase)
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
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
 * 7. ESTELA CÓSMICA (Particles) - Micro-núcleo estelar emisor de partículas vivas
 */
export function renderParticles(rc: RenderContext) {
  const { ctx, width, centerY, progressX, isPlaying, state, delta, primaryColor, trackColor, thumbColor } = rc;

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

  // Activo: Haz de plasma
  if (progressX > 0) {
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.moveTo(0, centerY);
    ctx.lineTo(progressX, centerY);
    ctx.stroke();

    // Generar nuevas partículas en la posición del thumb
    if (isPlaying && state.particles.length < 35 && Math.random() < 0.65) {
      state.particles.push({
        x: progressX,
        y: centerY + (Math.random() - 0.5) * 4,
        vx: -(Math.random() * 25 + 15 + Math.abs(state.fluidVelocity) * 20),
        vy: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: Math.random() * 0.8 + 0.5,
        size: Math.random() * 2.2 + 1.2,
        color: Math.random() > 0.3 ? primaryColor : "#ffffff",
      });
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
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Thumb: Estrella brillante
  const thumbX = Math.min(Math.max(progressX, 5), width - 5);
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 8;
  ctx.fillStyle = thumbColor;
  ctx.beginPath();
  ctx.arc(thumbX, centerY, 5.5, 0, Math.PI * 2);
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
    case "classic":
    default:
      renderClassic(rc);
      break;
  }
}

// Adaptación de Aurora; regenerar con sync-aurora-wallpapers.ts.
import * as React from "react";
import { useEffect, useRef } from "react";
type ParticleShape = "tech"|"circle"|"star"|"heart"|"square"|"diamond"|"sparkle"|"ripple"|"digits"|"bubble"|"petal"|"note"|"snow";
type ParticleDirection="down"|"up"|"float";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    decay: number;
    rotation: number;   // para formas no radialmente simétricas
    rotSpeed: number;
    state?: "falling" | "ripple";
    targetY?: number;
    digit?: string;
}

export interface ParticleLayerProps {
    color?: string;
    paused?: boolean;
    intensity: number;
    sizeMultiplier?: number;
    densityMultiplier?: number;
    speedMultiplier?: number;
    shape?: ParticleShape;
    direction?: ParticleDirection;
    visualIntensity?: number;
    voiceActivity?: number;
}

// ─── Dibujar formas ──────────────────────────────────────────────────────────

function generateBinaryChunk(): string {
    const len = Math.random() > 0.4 ? 4 : 3;
    let s = "";
    for (let i = 0; i < len; i++) {
        s += Math.random() > 0.5 ? "1" : "0";
    }
    return s;
}

export function drawShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    shape: ParticleShape,
    rotation: number,
    state?: "falling" | "ripple",
    digit = "101"
) {
    ctx.save();
    ctx.translate(x, y);
    if (shape !== "digits" && shape !== "tech") {
        ctx.rotate(rotation);
    }

    ctx.beginPath();
    switch (shape) {
        case "digits":
            ctx.fillStyle = "#00ffcc";
            ctx.shadowColor = "rgba(0, 255, 204, 0.75)";
            ctx.shadowBlur = 4;
            ctx.font = `700 ${Math.max(11, size * 2.4)}px ui-monospace, Menlo, Consolas, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(digit, 0, 0);
            break;
        case "note":
            ctx.font = `600 ${Math.max(12, size * 3)}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("♪", 0, 0);
            break;
        case "bubble":
            ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2);
            ctx.lineWidth = 1.2; ctx.stroke();
            ctx.beginPath(); ctx.arc(-size * 0.3, -size * 0.3, size * 0.2, 0, Math.PI * 2);
            break;
        case "petal":
            ctx.ellipse(0, 0, size * 0.5, size * 1.3, 0.4, 0, Math.PI * 2);
            break;
        case "snow":
            ctx.lineWidth = 1.3;
            for (let arm = 0; arm < 6; arm++) {
                const angle = arm * Math.PI / 3;
                ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
            }
            ctx.stroke();
            break;
        case "circle":
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            break;

        case "star": {
            const outerR = size;
            const innerR = size * 0.45;
            const points = 5;
            for (let i = 0; i < points * 2; i++) {
                const r = i % 2 === 0 ? outerR : innerR;
                const a = (i * Math.PI) / points - Math.PI / 2;
                if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
                else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
            }
            ctx.closePath();
            break;
        }

        case "heart": {
            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#ef4444';
            const s = size * 0.8;
            ctx.moveTo(0, s * 0.3);
            ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.5, s * 0.8, 0, s * 1.4);
            ctx.bezierCurveTo(s * 1.5, s * 0.8, s, -s * 0.5, 0, s * 0.3);
            break;
        }

        case "diamond": {
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.6, 0);
            ctx.lineTo(0, size);
            ctx.lineTo(-size * 0.6, 0);
            ctx.closePath();
            break;
        }

        case "square": {
            const s2 = size * 0.75;
            ctx.rect(-s2, -s2, s2 * 2, s2 * 2);
            break;
        }

        case "sparkle": {
            // Cruz de 4 puntas elongadas
            const len = size * 1.2, thin = size * 0.15;
            ctx.moveTo(-thin, -len);
            ctx.lineTo(thin, -len); ctx.lineTo(thin, -thin); ctx.lineTo(len, -thin);
            ctx.lineTo(len, thin); ctx.lineTo(thin, thin); ctx.lineTo(thin, len);
            ctx.lineTo(-thin, len); ctx.lineTo(-thin, thin); ctx.lineTo(-len, thin);
            ctx.lineTo(-len, -thin); ctx.lineTo(-thin, -thin);
            ctx.closePath();
            break;
        }

        case "tech": {
            // Estela luminosa vertical cibernética (haz láser cian/verde matriz con cabeza brillante)
            const len = Math.max(22, size * 8.5);
            const tailY = rotation < 0 ? len : -len;
            const grad = ctx.createLinearGradient(0, tailY, 0, 0);
            grad.addColorStop(0, "rgba(0, 255, 170, 0)");        // cola transparente
            grad.addColorStop(0.65, "rgba(0, 255, 170, 0.75)");  // haz cian/verde
            grad.addColorStop(1, "rgba(225, 255, 250, 0.98)");   // cabeza brillante
            ctx.strokeStyle = grad;
            ctx.lineWidth = Math.max(2, size * 0.85);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, tailY);
            ctx.stroke();

            // Cabeza brillante aditiva
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(2.4, size * 0.7), 0, Math.PI * 2);
            ctx.fill();

            // Glifo digital en la estela de Números Tech
            ctx.font = `800 ${Math.max(10, size * 2.2)}px ui-monospace, Menlo, Consolas, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#00ffcc";
            ctx.fillText(digit || "1", 0, tailY * 0.45);
            break;
        }

        case "ripple": {
            if (state === "falling") {
                // Dibujar gota de lluvia cayendo
                ctx.moveTo(0, -6);
                ctx.lineTo(0, 6);
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else {
                // Dibujar onda expansiva concéntrica
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
            break;
        }
    }

    if (shape !== "ripple" && shape !== "tech") {
        ctx.fill();
    }
    ctx.restore();
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ParticleLayer({
    color = "rgba(200, 200, 220, 0.45)",
    paused = false,
    intensity,
    sizeMultiplier = 1,
    densityMultiplier = 1,
    speedMultiplier = 1,
    shape = "circle",
    direction = "float",
    visualIntensity = 1,
    voiceActivity = 0,
}: ParticleLayerProps) {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const frameRef     = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);

    const colorRef = useRef(color);
    const pausedRef = useRef(paused);
    const resumeRef = useRef<(() => void) | null>(null);
    const intensityRef   = useRef(intensity);
    const sizeMultRef    = useRef(sizeMultiplier);
    const densityMultRef = useRef(densityMultiplier);
    const speedMultRef   = useRef(speedMultiplier);
    const shapeRef       = useRef(shape);
    const directionRef   = useRef(direction);
    const visualRef = useRef({ visualIntensity, voiceActivity });
    useEffect(() => { visualRef.current = { visualIntensity, voiceActivity }; }, [visualIntensity, voiceActivity]);

    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { pausedRef.current = paused; if (paused) cancelAnimationFrame(frameRef.current); else resumeRef.current?.(); }, [paused]);
    useEffect(() => { intensityRef.current = intensity;           }, [intensity]);
    useEffect(() => { sizeMultRef.current = sizeMultiplier;       }, [sizeMultiplier]);
    useEffect(() => { densityMultRef.current = densityMultiplier; }, [densityMultiplier]);
    useEffect(() => { speedMultRef.current = speedMultiplier;     }, [speedMultiplier]);
    useEffect(() => { directionRef.current = direction;           }, [direction]);
    useEffect(() => { shapeRef.current = shape; particlesRef.current = []; }, [shape]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

        const onResize = () => {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", onResize);

        const spawnParticle = (): Particle => {
            const isRipple = shapeRef.current === "ripple";
            const dir = directionRef.current || "float";

            if (isRipple) {
                const fall = dir !== "up";
                return {
                    x:        Math.random() * canvas.width,
                    y:        fall ? -15 : canvas.height + 15,
                    vx:       (Math.random() - 0.5) * 0.4,
                    vy:       (fall ? 1 : -1) * (Math.random() * 5 + 9),
                    size:     (Math.random() * 1.8 + 0.8) * sizeMultRef.current,
                    alpha:    1.0,
                    decay:    0.014 + Math.random() * 0.008,
                    rotation: 0,
                    rotSpeed: 0,
                    state:    "falling",
                    targetY:  fall ? canvas.height - Math.random() * 110 : Math.random() * 110,
                };
            }

            const isTech = shapeRef.current === "tech";
            const defaultFalling = ['digits', 'snow', 'petal', 'tech'].includes(shapeRef.current);
            const mode = dir || (defaultFalling ? 'down' : 'float');

            let startY = 0;
            let vy = 0;
            let vx = (Math.random() - 0.5) * (isTech ? 0.2 : 0.8);
            let decay = Math.random() * 0.004 + 0.002;

            if (mode === "down") {
                startY = -20;
                vy = isTech ? (Math.random() * 5 + 7) : (Math.random() * 1.2 + 0.5);
                decay = isTech ? 0.0008 : (defaultFalling ? 0.00025 : 0.0015);
            } else if (mode === "up") {
                startY = canvas.height + 20;
                vy = isTech ? -(Math.random() * 5 + 7) : -(Math.random() * 1.2 + 0.5);
                decay = isTech ? 0.0008 : 0.0015;
            } else {
                // "float"
                startY = Math.random() * canvas.height;
                vy = (Math.random() - 0.5) * (isTech ? 1.5 : 0.6);
                vx = (Math.random() - 0.5) * (isTech ? 0.2 : 0.6);
                decay = 0.002;
            }

            return {
                digit: shapeRef.current === "digits" ? generateBinaryChunk() : String(Math.floor(Math.random() * 10)),
                x:        Math.random() * canvas.width,
                y:        startY,
                vx,
                vy,
                size:     (Math.random() * 4 + 2) * sizeMultRef.current,
                alpha:    isTech ? (Math.random() * 0.3 + 0.7) : (Math.random() * 0.6 + 0.3),
                decay,
                rotation: isTech ? (vy < 0 ? -1 : 1) : Math.random() * Math.PI * 2,
                rotSpeed: isTech ? 0 : (Math.random() - 0.5) * 0.04,
            };
        };

        let spawnTimer = 0;

        let lastFrame = performance.now();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animate = (timestamp = performance.now()) => {
            const step = Math.min(2, Math.max(0.1, (timestamp - lastFrame) / (1000 / 60)));
            lastFrame = timestamp;
            if (!pausedRef.current) frameRef.current = requestAnimationFrame(animate);
            if (pausedRef.current || document.hidden) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const power = Math.max(0, Math.min(1, visualRef.current.visualIntensity));
            const voice = Math.max(0, Math.min(1, visualRef.current.voiceActivity));
            const curIntensity  = intensityRef.current * power * (1 + voice * 0.5);
            const color = colorRef.current;
            const densityMult   = densityMultRef.current;
            const speedMult     = speedMultRef.current * step * (reducedMotion ? 0.2 : 1 + voice * 0.7);
            const curShape      = shapeRef.current;

            const spawnFactor   = curShape === "ripple" ? 0.38 : 1.0;
            spawnTimer += curIntensity * densityMult * spawnFactor * step * (reducedMotion ? 0.2 : 1);

            if (spawnTimer >= 1) {
                const count = Math.floor(spawnTimer);
                for (let i = 0; i < Math.min(count, 300 - particlesRef.current.length); i++) particlesRef.current.push(spawnParticle());
                spawnTimer -= count;
            }

            particlesRef.current = particlesRef.current.filter(p => p.alpha > 0 && p.y < canvas.height + 30 && p.y > -30);
            for (const p of particlesRef.current) {
                if (curShape === "ripple") {
                    if (p.state === "falling") {
                        p.x += p.vx * speedMult;
                        p.y += p.vy * speedMult;
                        if (p.y >= (p.targetY || canvas.height - 20)) {
                            p.state = "ripple";
                            p.vx = 0;
                            p.vy = 0;
                            p.size = 2;
                            p.alpha = 0.8;
                        }
                    } else {
                        p.size += 1.8 * speedMult;
                        p.alpha -= p.decay * speedMult;
                    }
                } else {
                    p.x        += p.vx * speedMult;
                    p.y        += p.vy * speedMult;
                    p.alpha    -= p.decay * speedMult;
                    p.rotation += p.rotSpeed;
                }

                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha) * power;
                ctx.fillStyle   = curShape === "digits" ? "#00ffcc" : color;
                ctx.strokeStyle = curShape === "digits" ? "#00ffcc" : color;
                drawShape(ctx, p.x, p.y, p.size, curShape, curShape === 'digits' ? 0 : p.rotation, p.state, p.digit);
                ctx.restore();
            }
        };

        resumeRef.current = () => { lastFrame=performance.now();cancelAnimationFrame(frameRef.current);frameRef.current=requestAnimationFrame(animate); };
        animate();

        return () => {
            resumeRef.current=null;
            cancelAnimationFrame(frameRef.current);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            data-wallpaper-overlay-particles aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: 8, pointerEvents: "none" }}
        />
    );
}

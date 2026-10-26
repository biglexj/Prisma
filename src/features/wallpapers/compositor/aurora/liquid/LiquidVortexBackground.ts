// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from "three";
import type { DynamicBackground } from "../index";
import type { BackgroundControls } from "../controls";

/**
 * Flujo Líquido: campo de ruido a pantalla completa con remolino reactivo al ratón.
 *
 * Port del prototipo (createLiquidVortexScene): el quad se dibuja en NDC para cubrir
 * el 100% del viewport y el shader conserva las constantes de la referencia.
 * El zoom y el desplazamiento del panel se resuelven aquí porque el quad ignora
 * la cámara de escenario (no hay proyección que los escale).
 */
export class LiquidVortexBackground implements DynamicBackground {
    private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    private material: THREE.ShaderMaterial | null = null;
    /** Cursor en NDC (-1..1), igual que la referencia. */
    private readonly targetMouse = new THREE.Vector2(0, 0);
    private readonly currentMouse = new THREE.Vector2(0, 0);
    private zoom = 1;
    private readonly pan = new THREE.Vector2(0, 0);
    private speed = 1;

    init(scene: THREE.Scene, _camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 0.85 },
                uMouse: { value: new THREE.Vector2(0, 0) },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uZoom: { value: 1 },
                uPan: { value: new THREE.Vector2(0, 0) },
                uFade: { value: 1 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec2 uMouse;
                uniform vec2 uResolution;
                uniform float uIntensity;
                uniform float uZoom;
                uniform vec2 uPan;
                uniform float uFade;
                varying vec2 vUv;

                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                        u.y
                    );
                }
                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    vec2 shift = vec2(100.0);
                    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                    for (int i = 0; i < 4; ++i) {
                        v += a * noise(p);
                        p = rot * p * 2.0 + shift;
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    // Zoom y desplazamiento del panel resueltos en el shader.
                    float zoom = max(0.35, uZoom);
                    vec2 uv = (vUv - 0.5) / zoom + 0.5 - uPan / (20.0 * zoom);
                    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
                    vec2 mouseUv = uMouse * 0.5 + 0.5;
                    vec2 d = (vUv - mouseUv) * aspect;
                    float dist = length(d);

                    // El remolino gira alrededor del cursor también con zoom aplicado.
                    vec2 mouseZoomed = (mouseUv + uPan / (20.0 * zoom) - 0.5) * zoom + 0.5;

                    float swirlStrength = exp(-dist * 7.5) * 6.8 * (0.8 + uIntensity * 0.5);
                    float angle = swirlStrength + uTime * 0.16;
                    mat2 rotMat = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));

                    vec2 swirledUv = mix(uv, mouseZoomed + rotMat * (uv - mouseZoomed), exp(-dist * 4.2));

                    float n1 = fbm(swirledUv * 3.2 + uTime * 0.07);
                    float n2 = fbm(swirledUv * 6.2 - uTime * 0.09 + vec2(n1));
                    float flow = fbm(swirledUv * 4.0 + vec2(n2 * 1.6));

                    vec3 colTeal = vec3(0.0, 0.78, 0.69);
                    vec3 colPink = vec3(0.98, 0.47, 0.58);
                    vec3 colYellow = vec3(0.91, 1.0, 0.05);

                    vec3 colorMix = mix(colTeal, colPink, flow);
                    colorMix = mix(colorMix, colYellow, n2 * n2 * 0.48);

                    vec3 finalColor = mix(vec3(0.02, 0.015, 0.04), colorMix, flow * 0.78 + n1 * 0.35) * uIntensity;
                    float cursorGlow = exp(-dist * 18.0) * 0.55;
                    finalColor += vec3(0.6, 0.95, 1.0) * cursorGlow;

                    gl_FragColor = vec4(finalColor, uFade);
                }
            `,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -10;
        scene.add(mesh);

        this.mesh = mesh;
        this.material = material;
        this.applyControls();
    }

    /** El motor entrega el delta ya escalado por la velocidad; se compensa para igualar la referencia. */
    private applyControls(): void {
        if (!this.material) return;
        this.material.uniforms.uZoom.value = this.zoom;
        this.material.uniforms.uPan.value.copy(this.pan);
    }

    setControls(controls: Readonly<BackgroundControls>): void {
        this.zoom = controls.zoom;
        this.pan.set(controls.panX, controls.panY);
        this.speed = controls.speed;
        this.applyControls();
    }

    update(delta: number, intensity: number, time: number, transparent = false): void {
        const material = this.material;
        if (!material) return;
        // La referencia suaviza el cursor a ~6 por segundo.
        const smoothing = Math.min(1, (delta * 6) / Math.max(this.speed, 0.001));
        this.currentMouse.lerp(this.targetMouse, smoothing);
        material.uniforms.uTime.value = time;
        material.uniforms.uMouse.value.copy(this.currentMouse);
        // 0.85 es la intensidad de reposo del prototipo; el motor entrega 0.7 como base.
        material.uniforms.uIntensity.value = 0.85 + (intensity - 0.7) * 0.55;
        material.uniforms.uFade.value = transparent ? 0.65 : 1;
    }

    onMouseMove(x: number, y: number): void {
        this.targetMouse.set(x, y);
    }

    onResize(width: number, height: number): void {
        if (this.material) this.material.uniforms.uResolution.value.set(width, height);
    }

    dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh.parent?.remove(this.mesh);
            this.mesh = null;
            this.material = null;
        }
    }
}

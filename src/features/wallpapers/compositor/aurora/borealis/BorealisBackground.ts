// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from "three";
import type { DynamicBackground } from "../index";

export class BorealisBackground implements DynamicBackground {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;

    init(scene: THREE.Scene, camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
        const geo = new THREE.PlaneGeometry(45, 30);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_intensity: { value: 1.0 },
                u_transparent: { value: 0.0 },
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform float u_intensity;
                uniform float u_transparent;
                varying vec2 vUv;

                // Hash de ruido pseudo-aleatorio
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                // Ruido de gradiente 2D
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

                // Movimiento Browniano Fraccional (FBM)
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
                    vec2 uv = vUv;
                    
                    // Distorsión FBM (flujo de viento solar)
                    vec2 warp = vec2(
                        fbm(uv * 4.0 + vec2(u_time * 0.04, u_time * 0.02)),
                        fbm(uv * 3.5 - vec2(u_time * 0.03, u_time * 0.05))
                    );
                    
                    vec2 distortedUv = uv + warp * 0.16;
                    
                    // Ondulación de las bandas de la aurora
                    float band1 = sin(distortedUv.x * 2.0 + u_time * 0.08) * 0.15 + 0.5;
                    float dist1 = abs(distortedUv.y - band1);
                    float glow1 = exp(-dist1 * 7.0) * 0.7;
                    
                    float band2 = cos(distortedUv.x * 3.0 - u_time * 0.06) * 0.12 + 0.45;
                    float dist2 = abs(distortedUv.y - band2);
                    float glow2 = exp(-dist2 * 8.5) * 0.6;
                    
                    float totalGlow = (glow1 + glow2) * (0.7 + u_intensity * 0.4);
                    
                    // Colores de marca Ely (Teal y Rosa Aurora)
                    vec3 colTeal = vec3(0.0, 0.78, 0.69); // #00C7B1
                    vec3 colPink = vec3(0.98, 0.47, 0.58); // #F97894
                    vec3 colSpace = vec3(0.015, 0.01, 0.04); // espacio cósmico oscuro
                    
                    // Mezcla dinámica de colores
                    float colorMix = fbm(uv * 1.5 + u_time * 0.03);
                    vec3 auroraColor = mix(colTeal, colPink, colorMix);
                    
                    // Color final de la aurora
                    vec3 finalColor = mix(colSpace, auroraColor, clamp(totalGlow, 0.0, 1.0));
                    
                    // Estrellas estáticas de fondo usando ruido granular de alta frecuencia
                    float starNoise = hash(floor(uv * 150.0));
                    if (starNoise > 0.996) {
                        float twinkle = sin(u_time * 3.0 + starNoise * 100.0) * 0.5 + 0.5;
                        finalColor += vec3(twinkle * 0.45);
                    }
                    
                    // Si el fondo es transparente, la opacidad depende exclusivamente de la aurora
                    float alpha = mix(1.0, clamp(totalGlow * 1.6, 0.0, 1.0), u_transparent);
                    
                    // En modo integrado (transparente), el color de fondo no debe teñir la imagen inferior
                    vec3 outputColor = mix(finalColor, auroraColor * totalGlow, u_transparent);
                    
                    gl_FragColor = vec4(outputColor, alpha);
                }
            `,
            depthWrite: false,
            depthTest: true,
            transparent: true
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(0, 0, -8);
        scene.add(this.mesh);
    }

    update(_delta: number, intensity: number, time: number, transparent?: boolean): void {
        if (this.material) {
            this.material.uniforms.u_time.value = time;
            this.material.uniforms.u_intensity.value = intensity;
            this.material.uniforms.u_transparent.value = transparent ? 1.0 : 0.0;
        }
    }

    onResize(width: number, height: number): void {
        if (this.material) {
            this.material.uniforms.u_resolution.value.set(width, height);
        }
    }

    dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh.parent?.remove(this.mesh);
            this.mesh = null;
            this.material = null;
        }
    }
}

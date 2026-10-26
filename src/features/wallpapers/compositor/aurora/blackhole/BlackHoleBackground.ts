// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from "three";
import type { DynamicBackground } from "../index";

export class BlackHoleBackground implements DynamicBackground {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;

    init(scene: THREE.Scene, camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
        const geo = new THREE.PlaneGeometry(2, 2);

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
                    gl_Position = vec4(position.xy, 0.999, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform float u_intensity;
                uniform float u_transparent;
                varying vec2 vUv;

                // Hash de ruido para granularidad
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(128.1, 311.7))) * 43758.5453123);
                }

                float periodicHash(vec2 p, float period) {
                    return hash(vec2(mod(p.x, period), p.y));
                }

                // La cuadrícula de ruido cierra exactamente una vuelta angular.
                float noise(vec2 p, float period) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(periodicHash(i + vec2(0.0, 0.0), period), periodicHash(i + vec2(1.0, 0.0), period), u.x),
                        mix(periodicHash(i + vec2(0.0, 1.0), period), periodicHash(i + vec2(1.0, 1.0), period), u.x),
                        u.y
                    );
                }

                void main() {
                    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                    float scale = 0.65;
                    vec2 uv = (vUv - 0.5) * aspect * scale;

                    float r = length(uv);
                    vec2 dir = uv / max(r, 0.00001);

                    float horizonRadius = 0.08;
                    vec3 finalColor = vec3(0.0);

                    // Lente gravitacional
                    vec2 distortedUv = vUv;
                    if (r > horizonRadius) {
                        float deflection = (horizonRadius * horizonRadius) / r;
                        distortedUv = vUv - (dir / aspect) * deflection * 0.45 / scale;
                    }

                    // Estrellas de fondo (se ocultan si es transparente para ver el fondo real de la sala)
                    vec2 starGrid = distortedUv * aspect * 160.0;
                    float bgStarNoise = hash(floor(starGrid));
                    float starGlow = 0.0;
                    if (bgStarNoise > 0.995 && r > horizonRadius) {
                        float twinkle = sin(u_time * 0.4 + bgStarNoise * 50.0) * 0.15 + 0.65;
                        vec2 starUv = fract(starGrid) - 0.5;
                        starGlow = twinkle * 0.55 * exp(-dot(starUv, starUv) * 100.0);
                    }

                    finalColor += vec3(starGlow * (1.0 - u_transparent)); // no dibujar estrellas si es transparente

                    // Disco de Acreción
                    float diskInner = horizonRadius + 0.02;
                    float diskOuter = 0.42;
                    vec3 diskColor = vec3(0.0);
                    float brightness = 0.0;

                    if (r > horizonRadius && r < diskOuter) {
                        float orbitSpeed = 2.4 / (r + 0.1);
                        float angle = atan(uv.y, uv.x);
                        float swirl = angle - u_time * orbitSpeed;

                        // Conserva las bandas originales, sin salto entre -pi y +pi.
                        const float TAU = 6.28318530718;
                        float gasDensity = mix(noise(vec2(swirl * (32.0 / TAU), r * 28.0), 32.0), noise(vec2(swirl * (13.0 / TAU) - u_time * 0.5, r * 14.0), 13.0), 0.5);
                        float glowIntensity = exp(-abs(r - diskInner) * 9.5) * 1.5;
                        float falloff = 1.0 - smoothstep(diskInner, diskOuter, r);
                        brightness = glowIntensity * falloff * (0.55 + 0.45 * gasDensity);

                        vec3 colHot = vec3(0.6, 0.95, 1.0);
                        vec3 colMid = vec3(0.98, 0.35, 0.65);
                        vec3 colCool = vec3(0.9, 0.1, 0.15);

                        if (r < diskInner + 0.08) {
                            diskColor = mix(colHot, colMid, clamp((r - diskInner) / 0.08, 0.0, 1.0));
                        } else {
                            diskColor = mix(colMid, colCool, clamp((r - diskInner - 0.08) / (diskOuter - diskInner - 0.08), 0.0, 1.0));
                        }
                    }

                    vec3 activeDisk = diskColor * brightness * u_intensity;
                    finalColor += activeDisk;

                    // Horizonte de sucesos negro
                    if (r <= horizonRadius) {
                        finalColor = vec3(0.0);
                    }

                    // Determinar transparencia
                    float alpha = 1.0;
                    if (u_transparent > 0.5) {
                        if (r <= horizonRadius) {
                            alpha = 1.0; // el centro del agujero negro es opaco
                        } else {
                            // La opacidad depende de la intensidad del gas del disco
                            alpha = clamp(brightness * u_intensity * 1.8, 0.0, 1.0);
                        }
                    }

                    vec3 outputColor = mix(finalColor, r <= horizonRadius ? vec3(0.0) : activeDisk, u_transparent);

                    gl_FragColor = vec4(outputColor, alpha);
                }
            `,
            depthWrite: false,
            depthTest: false,
            transparent: true
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -100;
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

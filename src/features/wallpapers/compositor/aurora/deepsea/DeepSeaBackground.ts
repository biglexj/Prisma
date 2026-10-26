// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from "three";
import type { DynamicBackground } from "../index";

/**
 * Abismo Marino: gradiente abisal con rayos de luz y plancton bioluminiscente.
 *
 * El fondo es un cilindro hueco: la cámara de escenario orbita dentro del cilindro
 * y nunca alcanza a ver un borde, así que el giro en su eje o la cámara 360 no
 * dejan un corte negro contra el fondo estático.
 */
export class DeepSeaBackground implements DynamicBackground {
    private mesh: THREE.Mesh | null = null;
    private shaderMat: THREE.ShaderMaterial | null = null;
    private points: THREE.Points | null = null;
    private pointMat: THREE.PointsMaterial | null = null;

    init(scene: THREE.Scene, _camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
        // 1. Cilindro hueco (interior visible) con el degradado y los rayos de luz
        const radius = 90;
        const height = 180;
        const geo = new THREE.CylinderGeometry(radius, radius, height, 72, 1, true);

        this.shaderMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_intensity: { value: 1.0 },
                u_transparent: { value: 0 },
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_repeat: { value: 6 }
            },
            vertexShader: `
                varying vec3 vDir;
                varying float vLocalY;
                void main() {
                    vDir = normalize(position);
                    vLocalY = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform float u_intensity;
                uniform float u_transparent;
                uniform float u_repeat;
                varying vec3 vDir;
                varying float vLocalY;

                // Hash simple
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                // Ruido 2D
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

                // Ruido con la celda X envolvente: el patrón cierra sin costura
                // cuando el cilindro da la vuelta completa.
                float pnoise(vec2 p, float period) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    float x0 = mod(i.x, period);
                    float x1 = mod(i.x + 1.0, period);
                    return mix(
                        mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), u.x),
                        mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), u.x),
                        u.y
                    );
                }

                void main() {
                    // Ángulo alrededor del cilindro: continuo y sin costura.
                    float angle = atan(vDir.x, vDir.z);
                    float u = angle * u_repeat / 6.2831853;
                    // Altura equivalente al plano original, para conservar el degradado.
                    float h = vLocalY * 0.00456 + 0.5;

                    // Gradiente abisal profundo (Azul oscuro profundo -> Turquesa apagado arriba)
                    vec3 colDeep = vec3(0.005, 0.015, 0.04);
                    vec3 colShallow = vec3(0.02, 0.22, 0.28); // Teal marino
                    vec3 waterColor = mix(colDeep, colShallow, h * 0.95);

                    // Simulación de Rayos de Luz (God Rays) filtrándose
                    // Los rayos de luz están inclinados y se mueven sutilmente de lado a lado
                    float angleOffset = h * 0.38;
                    float ray1 = pnoise(vec2(u - angleOffset + u_time * 0.04, u_time * 0.02), u_repeat);
                    float ray2 = pnoise(vec2(u * 2.0 + angleOffset - u_time * 0.06, u_time * 0.01), u_repeat * 2.0);

                    float rays = mix(ray1, ray2, 0.5);
                    // Concentrar brillo en la parte superior
                    rays *= smoothstep(-0.2, 0.85, h);

                    // Resplandor de rayos
                    vec3 colRay = vec3(0.0, 0.78, 0.69) * pow(rays, 2.5) * 0.42 * (0.8 + u_intensity * 0.4);

                    // Agregar brillo final
                    vec3 finalColor = waterColor + colRay;

                    // Ondas cáusticas sutiles de fondo
                    float caustic = pnoise(vec2(u * 12.0, h * 12.0) + vec2(u_time * 0.08, sin(u_time * 0.05)), u_repeat * 12.0);
                    finalColor += vec3(caustic) * 0.015 * h;

                    vec3 overlayColor = colRay + vec3(caustic) * 0.015 * h;
                    float glow = max(overlayColor.r, max(overlayColor.g, overlayColor.b));
                    float alpha = mix(1.0, clamp(glow * 2.0, 0.0, 0.65), u_transparent);
                    vec3 outputColor = mix(finalColor, overlayColor / max(alpha, 0.001), u_transparent);
                    gl_FragColor = vec4(outputColor, alpha);
                }
            `,
            depthWrite: false,
            transparent: true,
            depthTest: true,
            side: THREE.BackSide
        });

        this.mesh = new THREE.Mesh(geo, this.shaderMat);
        scene.add(this.mesh);

        // 2. Partículas 3D Bioluminiscentes (Plancton flotando a la deriva)
        const pCount = 320;
        const positions = new Float32Array(pCount * 3);
        const randomSpeeds = new Float32Array(pCount);

        for (let i = 0; i < pCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 44.0;      // X
            positions[i * 3 + 1] = (Math.random() - 0.5) * 24.0;  // Y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 44.0;  // Z
            randomSpeeds[i] = Math.random() * 0.15 + 0.08;
        }

        const pointGeo = new THREE.BufferGeometry();
        pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        pointGeo.setAttribute("a_speed", new THREE.BufferAttribute(randomSpeeds, 1));

        this.pointMat = new THREE.PointsMaterial({
            color: 0x00c7b1, // Turquesa bioluminiscente de Ely
            size: 0.075,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(pointGeo, this.pointMat);
        scene.add(this.points);
    }

    update(delta: number, intensity: number, time: number, transparent = false): void {
        if (this.shaderMat) {
            this.shaderMat.uniforms.u_time.value = time;
            this.shaderMat.uniforms.u_intensity.value = intensity;
            this.shaderMat.uniforms.u_transparent.value = transparent ? 1 : 0;
        }

        if (this.points && this.pointMat) {
            const geo = this.points.geometry as THREE.BufferGeometry;
            const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
            const speedAttr = geo.getAttribute("a_speed") as THREE.BufferAttribute;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i);
                let y = posAttr.getY(i);
                let z = posAttr.getZ(i);
                const speed = speedAttr.getX(i);

                // Movimiento senoidal a la deriva marina
                x += Math.sin(time * 0.45 + i) * 0.0035 * delta * 60;
                y += speed * 0.035 * delta * 60;

                // Si sale de la pantalla, reiniciar abajo
                if (y > 11.5) {
                    y = -11.5;
                    x = (Math.random() - 0.5) * 44.0;
                }

                posAttr.setXYZ(i, x, y, z);
            }
            posAttr.needsUpdate = true;

            // Pulso de brillo bioluminiscente
            this.pointMat.opacity = (0.45 + Math.sin(time * 1.5) * 0.15) * (0.7 + intensity * 0.3);
        }
    }

    onResize(width: number, height: number): void {
        if (this.shaderMat) {
            this.shaderMat.uniforms.u_resolution.value.set(width, height);
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
            this.shaderMat = null;
        }
        if (this.points) {
            this.points.geometry.dispose();
            if (Array.isArray(this.points.material)) {
                this.points.material.forEach(m => m.dispose());
            } else {
                this.points.material.dispose();
            }
            this.points.parent?.remove(this.points);
            this.points = null;
            this.pointMat = null;
        }
    }
}

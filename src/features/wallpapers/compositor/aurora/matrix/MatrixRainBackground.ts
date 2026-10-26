// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from "three";
import type { DynamicBackground } from "../index";

export class MatrixRainBackground implements DynamicBackground {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;

    init(scene: THREE.Scene, _camera: THREE.Camera, _renderer: THREE.WebGLRenderer): void {
        const geo = new THREE.PlaneGeometry(45, 30);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_intensity: { value: 1.0 },
                u_transparent: { value: 0 },
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

                // Hash aleatorio
                float hash(float x) {
                    return fract(sin(x) * 43758.5453123);
                }

                float hash2d(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                void main() {
                    // Dividir la pantalla en columnas verticales (grilla de código)
                    float numColumns = 65.0;
                    vec2 uv = vUv;

                    float colIndex = floor(uv.x * numColumns);
                    float colRandom = hash(colIndex);

                    // Velocidades aleatorias por columna
                    float speed = 0.35 + colRandom * 0.45;

                    // Tiempo desfasado por columna
                    float offsetTime = u_time * speed + colRandom * 100.0;

                    // Coordenada Y repetitiva para simular las gotas cayendo en cascada
                    float yGrid = 35.0; // filas
                    float rowIndex = floor(uv.y * yGrid - offsetTime * 15.0);

                    // Generar un patrón pseudo-aleatorio de caracteres digitales (flicker)
                    float charSeed = hash2d(vec2(colIndex, rowIndex));

                    // Dibujar el caracter: creamos barras horizontales y verticales
                    // simulando tipografías cuadriculadas tipo terminal
                    vec2 cellUv = fract(vec2(uv.x * numColumns, uv.y * yGrid - offsetTime * 15.0));

                    // Estilo de caracter binario / digital
                    float charMask = 1.0;
                    if (charSeed < 0.25) {
                        // Dibujar un 0 o bloque cuadrado hueco
                        charMask = step(0.1, cellUv.x) * step(cellUv.x, 0.9) * step(0.1, cellUv.y) * step(cellUv.y, 0.9);
                        charMask -= step(0.3, cellUv.x) * step(cellUv.x, 0.7) * step(0.3, cellUv.y) * step(cellUv.y, 0.7);
                    } else if (charSeed < 0.5) {
                        // Dibujar una línea vertical (número 1 o símbolo)
                        charMask = step(0.4, cellUv.x) * step(cellUv.x, 0.6) * step(0.15, cellUv.y) * step(cellUv.y, 0.85);
                    } else if (charSeed < 0.75) {
                        // Dibujar una cruz (+)
                        charMask = (step(0.4, cellUv.x) * step(cellUv.x, 0.6) * step(0.2, cellUv.y) * step(cellUv.y, 0.8)) +
                                   (step(0.2, cellUv.x) * step(cellUv.x, 0.8) * step(0.4, cellUv.y) * step(cellUv.y, 0.6));
                        charMask = clamp(charMask, 0.0, 1.0);
                    } else {
                        // Caracter vacío / espacio para espaciamiento orgánico
                        charMask = 0.0;
                    }

                    // Evitar bordes duros de los caracteres
                    charMask *= step(0.08, cellUv.x) * step(cellUv.x, 0.92) * step(0.08, cellUv.y) * step(cellUv.y, 0.92);

                    // Estructura de la estela de lluvia (fade-out hacia arriba)
                    // fract(uv.y + offsetTime) crea una sierra que cae continuamente
                    float trail = fract(uv.y * 1.5 + offsetTime * 0.45);
                    trail = pow(trail, 3.8); // endurecer el gradiente para crear una "cabeza" brillante

                    // Flicker de brillo al vuelo
                    float fader = charSeed > 0.8 ? 0.3 : 1.0;
                    float brightness = trail * charMask * fader * (0.5 + u_intensity * 0.5);

                    // Colores de Lluvia Digital:
                    // Mezcla entre el clásico Matrix Green (#00FF55) y el Teal de Ely (#00C7B1)
                    vec3 colClassicMatrix = vec3(0.0, 1.0, 0.3);
                    vec3 colElyTeal = vec3(0.0, 0.78, 0.69);

                    // El color muta suavemente según la columna y la altura
                    vec3 baseColor = mix(colClassicMatrix, colElyTeal, sin(colIndex * 0.05 + u_time * 0.1) * 0.5 + 0.5);

                    // El extremo frontal (cabeza de la gota) es casi blanco puro
                    vec3 headColor = vec3(0.8, 1.0, 0.9);
                    vec3 finalColor = mix(baseColor, headColor, pow(trail, 7.0)) * brightness;

                    // Agregar brillo de brillo radial en el fondo
                    vec3 colBg = vec3(0.002, 0.015, 0.01) * charMask * 0.1;
                    finalColor += colBg;

                    float alpha = mix(1.0, clamp(brightness, 0.0, 1.0), u_transparent);
                    vec3 outputColor = mix(finalColor, finalColor / max(alpha, 0.001), u_transparent);
                    gl_FragColor = vec4(outputColor, alpha);
                }
            `,
            depthWrite: false,
            transparent: true,
            depthTest: true
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(0, 0, -8);
        scene.add(this.mesh);
    }

    update(_delta: number, intensity: number, time: number, transparent = false): void {
        if (this.material) {
            this.material.uniforms.u_time.value = time;
            this.material.uniforms.u_intensity.value = intensity;
            this.material.uniforms.u_transparent.value = transparent ? 1 : 0;
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

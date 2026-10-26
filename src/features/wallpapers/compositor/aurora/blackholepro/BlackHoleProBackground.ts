// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('../ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const bhSphereGeo = new THREE.SphereGeometry(3.5, 64, 64);
    const bhSphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bhSphere = new THREE.Mesh(bhSphereGeo, bhSphereMat);
    root.add(bhSphere);

    const lensGeo = new THREE.SphereGeometry(4.15, 64, 64);
    const lensMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 1.0 },
            uFade: { value: 1.0 }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uFade;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.2);
                vec3 cyan = vec3(0.18, 0.85, 0.82);
                vec3 purple = vec3(0.68, 0.32, 0.98);
                float wave = 0.5 + 0.5 * sin(uTime * 2.5 + normal.y * 5.0);
                vec3 col = mix(cyan, purple, wave) * fresnel * 2.4 * uIntensity;
                gl_FragColor = vec4(col, fresnel * 0.95 * uFade);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    root.add(new THREE.Mesh(lensGeo, lensMat));

    const diskCount = 8500;
    const diskGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(diskCount * 3);
    const colors = new Float32Array(diskCount * 3);
    const meta = [];

    const cInner = new THREE.Color(0xffffff);
    const cMid = new THREE.Color(0x2dd4bf);
    const cOuter = new THREE.Color(0x9333ea);

    for (let i = 0; i < diskCount; i++) {
        const r = 3.8 + Math.pow(Math.random(), 1.55) * 14.5;
        const angle = Math.random() * Math.PI * 2;
        const ySpread = (Math.random() - 0.5) * 0.48 * (1 - (r - 3.8) / 16.0);
        meta.push({ r, angle, ySpread, speed: (1.8 / Math.sqrt(r)) * (0.85 + Math.random() * 0.3) });

        const t = (r - 3.8) / 14.5;
        const c = new THREE.Color();
        if (t < 0.25) c.lerpColors(cInner, cMid, t / 0.25);
        else c.lerpColors(cMid, cOuter, (t - 0.25) / 0.75);

        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    diskGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    diskGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const diskMat = new THREE.PointsMaterial({
        size: 0.42,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const diskPoints = new THREE.Points(diskGeo, diskMat);
    diskPoints.rotation.x = 0.38;
    diskPoints.rotation.z = -0.14;
    root.add(diskPoints);

    return function updateBlackHole(dt, elapsed, energy) {
        lensMat.uniforms.uTime.value = elapsed;
        lensMat.uniforms.uIntensity.value = state.intensity + energy * 0.65;
        diskMat.size = (0.42 + energy * 0.28) * state.intensity;

        const posArr = diskGeo.attributes.position.array;
        const clickPull = state.clickStrength;

        for (let i = 0; i < diskCount; i++) {
            const p = meta[i];
            p.angle += p.speed * dt * (1.2 + energy * 0.8);
            p.r -= dt * 0.45 * (1 + clickPull * 2.5);
            if (p.r < 3.65) p.r = 17.5 + Math.random() * 1.2;

            const x = Math.cos(p.angle) * p.r;
            const z = Math.sin(p.angle) * p.r;
            const y = p.ySpread + Math.sin(p.angle * 3.0 + elapsed * 2.0) * 0.12;

            posArr[i * 3] = x;
            posArr[i * 3 + 1] = y;
            posArr[i * 3 + 2] = z;
        }
        diskGeo.attributes.position.needsUpdate = true;
    };
}

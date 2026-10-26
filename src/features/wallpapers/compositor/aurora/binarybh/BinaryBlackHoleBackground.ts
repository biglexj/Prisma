// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const bh1 = new THREE.Group();
    const bh2 = new THREE.Group();
    const lensingMaterials = [];

    function buildSingularityUnit(rimColorHex, secondaryColorHex) {
        const g = new THREE.Group();
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(2.05, 48, 48),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        g.add(sphere);

        const lensMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 1.0 },
                uFade: { value: 1.0 },
                uColor1: { value: new THREE.Color(rimColorHex) },
                uColor2: { value: new THREE.Color(secondaryColorHex) }
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
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
                    float pulse = 0.5 + 0.5 * sin(uTime * 3.0 + normal.y * 6.0);
                    vec3 col = mix(uColor1, uColor2, pulse) * fresnel * 2.5 * uIntensity;
                    gl_FragColor = vec4(col, fresnel * 0.95 * uFade);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false
        });
        lensingMaterials.push(lensMat);

        const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(2.48, 48, 48), lensMat);
        g.add(haloMesh);
        return g;
    }

    bh1.add(buildSingularityUnit(0x38bdf8, 0x818cf8));
    bh2.add(buildSingularityUnit(0xe879f9, 0xf43f5e));
    root.add(bh1);
    root.add(bh2);

    const count = 8500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const pMeta = [];

    const cCyan = new THREE.Color(0x38bdf8);
    const cMagenta = new THREE.Color(0xe879f9);
    const cWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
        const role = i < 2600 ? 'bridge' : (i < 5550 ? 'disk1' : 'disk2');
        const r = 2.35 + Math.random() * 5.4;
        const a = Math.random() * Math.PI * 2;
        const tBridge = Math.random();
        pMeta.push({ role, r, a, tBridge, speed: 2.5 + Math.random() * 3.5 });

        const c = new THREE.Color();
        if (role === 'bridge') c.lerpColors(cCyan, cMagenta, tBridge).lerp(cWhite, 0.35);
        else if (role === 'disk1') c.lerpColors(cWhite, cCyan, (r - 2.35) / 5.4);
        else c.lerpColors(cWhite, cMagenta, (r - 2.35) / 5.4);

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.42,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const plasmaPoints = new THREE.Points(geo, mat);
    // Tilt particle offsets, not their orbital centers: both live in root space.
    const tiltCos = Math.cos(0.48);
    const tiltSin = Math.sin(0.48);
    root.add(plasmaPoints);

    let orbitAngle = 0;
    return function updateBinaryBH(dt, elapsed, energy) {
        lensingMaterials.forEach(m => {
            m.uniforms.uTime.value = elapsed;
            m.uniforms.uIntensity.value = state.intensity + energy * 0.6;
        });

        orbitAngle += dt * 0.95 * (1 + energy * 0.5);
        const sep = 6.2 - state.clickStrength * 2.2;
        const x1 = Math.cos(orbitAngle) * sep;
        const z1 = Math.sin(orbitAngle) * sep;
        const x2 = -x1;
        const z2 = -z1;

        bh1.position.set(x1, Math.sin(orbitAngle) * 1.1, z1 * 0.85);
        bh2.position.set(x2, -Math.sin(orbitAngle) * 1.1, z2 * 0.85);

        mat.size = (0.42 + energy * 0.25) * state.intensity;
        const arr = geo.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const p = pMeta[i];
            if (p.role === 'bridge') {
                p.tBridge = (p.tBridge + dt * 0.45) % 1.0;
                const t = p.tBridge;
                // Fade every offset at the ends so the stream enters each singularity.
                const envelope = Math.sin(t * Math.PI);
                const offsetY = Math.sin(t * Math.PI * 2.0 + elapsed * 3.0) * 0.6 * envelope;
                const offsetZ = envelope * 1.8;
                arr[i * 3] = THREE.MathUtils.lerp(bh1.position.x, bh2.position.x, t)
                    + Math.cos(elapsed * 4.0 + i) * 0.35 * envelope;
                arr[i * 3 + 1] = THREE.MathUtils.lerp(bh1.position.y, bh2.position.y, t)
                    + offsetY * tiltCos - offsetZ * tiltSin;
                arr[i * 3 + 2] = THREE.MathUtils.lerp(bh1.position.z, bh2.position.z, t)
                    + offsetY * tiltSin + offsetZ * tiltCos;
            } else {
                p.a += (p.speed / p.r) * dt * 2.5;
                const center = p.role === 'disk1' ? bh1.position : bh2.position;
                const offsetY = Math.sin(p.a * 2.0 + elapsed) * 0.22;
                const offsetZ = Math.sin(p.a) * p.r;
                arr[i * 3] = center.x + Math.cos(p.a) * p.r;
                arr[i * 3 + 1] = center.y + offsetY * tiltCos - offsetZ * tiltSin;
                arr[i * 3 + 2] = center.z + offsetY * tiltSin + offsetZ * tiltCos;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

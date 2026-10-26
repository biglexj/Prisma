// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const coreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3.8, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    root.add(coreMesh);

    const count = 10000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const meta = [];

    const cWhiteGold = new THREE.Color(0xfffbeb);
    const cAmber = new THREE.Color(0xf59e0b);
    const cDeepRed = new THREE.Color(0x9a3412);

    for (let i = 0; i < count; i++) {
        const isLensedArch = i >= 6800;
        const r = isLensedArch
            ? 3.95 + Math.random() * 2.6
            : 4.1 + Math.pow(Math.random(), 1.4) * 14.0;
        const angle = Math.random() * Math.PI * 2;
        const sign = (i % 2 === 0) ? 1 : -1;

        meta.push({ r, angle, isLensedArch, sign, speed: (2.2 / Math.sqrt(r)) });

        const t = isLensedArch ? (r - 3.95) / 2.6 : (r - 4.1) / 14.0;
        const c = new THREE.Color();
        if (t < 0.22) c.lerpColors(cWhiteGold, cAmber, t / 0.22);
        else c.lerpColors(cAmber, cDeepRed, (t - 0.22) / 0.78);

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.45,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const gargantuaPoints = new THREE.Points(geo, mat);
    gargantuaPoints.rotation.z = 0.08;
    root.add(gargantuaPoints);

    const flareMat = new THREE.SpriteMaterial({
        map: softGlowTex,
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const anamorphicFlare = new THREE.Sprite(flareMat);
    anamorphicFlare.scale.set(38, 1.8, 1);
    root.add(anamorphicFlare);

    return function updateInterstellar(dt, elapsed, energy) {
        mat.size = (0.45 + energy * 0.25) * state.intensity;
        anamorphicFlare.scale.set(38 + energy * 12, (1.7 + energy * 1.1) * state.intensity, 1);

        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
            const p = meta[i];
            p.angle += p.speed * dt * (1.1 + energy * 0.5);

            if (!p.isLensedArch) {
                arr[i * 3] = Math.cos(p.angle) * p.r;
                arr[i * 3 + 1] = Math.sin(p.angle * 2.0) * 0.14;
                arr[i * 3 + 2] = Math.sin(p.angle) * p.r;
            } else {
                arr[i * 3] = Math.cos(p.angle) * p.r;
                arr[i * 3 + 1] = Math.sin(p.angle) * p.r * p.sign;
                arr[i * 3 + 2] = Math.cos(p.angle * 2.0) * 0.8;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

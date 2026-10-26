// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const count = 11000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const pData = [];

    const cThroat = new THREE.Color(0x67e8f9);
    const cMid = new THREE.Color(0x8b5cf6);
    const cOuter = new THREE.Color(0xf43f5e);

    for (let i = 0; i < count; i++) {
        const s = (Math.random() - 0.5) * 2.0;
        const angle = Math.random() * Math.PI * 2.0;
        const speed = 0.25 + Math.random() * 0.35;
        pData.push({ s, angle, speed, radialJitter: (Math.random() - 0.5) * 0.35 });

        const absS = Math.abs(s);
        const c = new THREE.Color();
        if (absS < 0.35) c.lerpColors(cThroat, cMid, absS / 0.35);
        else c.lerpColors(cMid, cOuter, (absS - 0.35) / 0.65);

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

    const funnel = new THREE.Points(geo, mat);
    funnel.rotation.x = 0.68;
    root.add(funnel);

    return function updateWormhole(dt, elapsed, energy) {
        mat.size = (0.42 + energy * 0.25) * state.intensity;
        const arr = geo.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const p = pData[i];
            p.s += dt * p.speed * (1 + energy * 0.6 + state.clickStrength * 1.5);
            if (p.s > 1.0) p.s -= 2.0;

            const absS = Math.abs(p.s);
            const r = 2.8 + Math.pow(absS, 1.85) * 13.8 + p.radialJitter;
            p.angle += (dt * 3.8) / (r * 0.45);

            const y = p.s * 11.5;
            arr[i * 3] = Math.cos(p.angle) * r;
            arr[i * 3 + 1] = y;
            arr[i * 3 + 2] = Math.sin(p.angle) * r;
        }
        geo.attributes.position.needsUpdate = true;
    };
}

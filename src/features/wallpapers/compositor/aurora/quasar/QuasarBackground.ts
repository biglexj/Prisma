// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const count = 10500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const meta = [];

    const cCore = new THREE.Color(0xffffff);
    const cJetBlue = new THREE.Color(0x38bdf8);
    const cTorusGold = new THREE.Color(0xfbbf24);
    const cTorusRed = new THREE.Color(0xbe123c);

    for (let i = 0; i < count; i++) {
        const isJet = i < count * 0.38;
        const angle = Math.random() * Math.PI * 2;
        const r = isJet ? (0.3 + Math.random() * 1.8) : (3.2 + Math.pow(Math.random(), 1.3) * 13.5);
        const h = isJet ? (Math.random() * 24.0) : ((Math.random() - 0.5) * (0.6 + Math.pow((r - 3.0) * 0.25, 1.4)));
        const pole = i % 2 === 0 ? 1 : -1;

        meta.push({ isJet, angle, r, h, pole, speed: isJet ? (10 + Math.random() * 10) : (6.0 / Math.pow(r, 1.1)) });

        const c = new THREE.Color();
        if (isJet) {
            c.lerpColors(cCore, cJetBlue, h / 24.0);
        } else {
            const t = (r - 3.2) / 13.5;
            if (t < 0.3) c.lerpColors(cCore, cTorusGold, t / 0.3);
            else c.lerpColors(cTorusGold, cTorusRed, (t - 0.3) / 0.7);
        }

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.44,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const quasarPoints = new THREE.Points(geo, mat);
    quasarPoints.rotation.z = 0.25;
    quasarPoints.rotation.x = 0.35;
    root.add(quasarPoints);

    return function updateQuasar(dt, elapsed, energy) {
        mat.size = (0.44 + energy * 0.26) * state.intensity;
        const arr = geo.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const m = meta[i];
            const ix = i * 3;
            if (m.isJet) {
                m.h = (m.h + dt * m.speed * (1 + energy * 0.8 + state.clickStrength)) % 24.0;
                m.angle += dt * 4.5;
                const helixR = (0.25 + m.h * 0.075) * m.r;
                arr[ix] = Math.cos(m.angle + m.h * 0.4) * helixR;
                arr[ix + 1] = m.pole * m.h;
                arr[ix + 2] = Math.sin(m.angle + m.h * 0.4) * helixR;
            } else {
                m.angle += dt * m.speed * (1 + energy * 0.5);
                arr[ix] = Math.cos(m.angle) * m.r;
                arr[ix + 1] = m.h + Math.sin(m.angle * 3.0 + elapsed * 2.0) * 0.2;
                arr[ix + 2] = Math.sin(m.angle) * m.r;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

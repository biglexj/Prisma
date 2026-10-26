// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const count = 11500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const meta = [];

    const numMedusas = 7;
    const medusas = [];
    for (let m = 0; m < numMedusas; m++) {
        medusas.push({
            center: new THREE.Vector3(
                (Math.random() - 0.5) * 22,
                (Math.random() - 0.5) * 14,
                (Math.random() - 0.5) * 10
            ),
            phase: m * 1.4,
            scale: 0.75 + (m % 3) * 0.22,
            hueBase: (0.48 + m * 0.09) % 1.0
        });
    }

    for (let i = 0; i < count; i++) {
        const mIdx = i % numMedusas;
        const isBell = (i % 10) < 6;
        const u = Math.random();
        const angle = Math.random() * Math.PI * 2;
        const tentacleIdx = i % 16;

        meta.push({
            mIdx,
            isBell,
            u,
            angle,
            tentacleAngle: (tentacleIdx / 16) * Math.PI * 2
        });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.4,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    root.add(new THREE.Points(geo, mat));
    const tempCol = new THREE.Color();

    return function updateJellyfish(dt, elapsed, energy) {
        mat.size = (0.4 + energy * 0.25) * state.intensity;
        const posArr = geo.attributes.position.array;
        const colArr = geo.attributes.color.array;

        medusas.forEach((med, idx) => {
            const swimCycle = Math.sin(elapsed * 2.4 + med.phase);
            const thrust = Math.max(0.15, swimCycle) * 2.2 * (1 + energy * 0.6);
            med.center.y += thrust * dt;
            med.center.x += Math.cos(elapsed * 0.7 + idx) * dt * 0.7;
            if (med.center.y > 11.5) med.center.y = -11.5;
        });

        for (let i = 0; i < count; i++) {
            const p = meta[i];
            const med = medusas[p.mIdx];
            const ix = i * 3;
            const cycle = elapsed * 2.4 + med.phase;
            const contract = 1.0 - 0.24 * Math.pow(0.5 + 0.5 * Math.sin(cycle), 2.0);

            if (p.isBell) {
                const domePhi = p.u * Math.PI * 0.58;
                const r = Math.sin(domePhi) * 2.8 * med.scale * contract;
                const y = Math.cos(domePhi) * 2.1 * med.scale * (2.0 - contract);
                const rimFrill = p.u > 0.82 ? Math.sin(p.angle * 12.0 + cycle * 2.0) * 0.16 : 0.0;

                posArr[ix] = med.center.x + Math.cos(p.angle) * (r + rimFrill);
                posArr[ix + 1] = med.center.y + y;
                posArr[ix + 2] = med.center.z + Math.sin(p.angle) * (r + rimFrill);

                const hue = (med.hueBase + p.u * 0.18 + elapsed * 0.05) % 1.0;
                tempCol.setHSL(hue, 0.92, 0.58 + (1.0 - p.u) * 0.25);
            } else {
                const len = p.u * 5.8 * med.scale;
                const waveX = Math.sin(cycle * 1.4 - p.u * 4.5 + p.tentacleAngle) * (0.45 * p.u);
                const waveZ = Math.cos(cycle * 1.4 - p.u * 4.5 + p.tentacleAngle) * (0.45 * p.u);
                const baseR = 1.35 * med.scale * contract;

                posArr[ix] = med.center.x + Math.cos(p.tentacleAngle) * baseR + waveX;
                posArr[ix + 1] = med.center.y - len + 0.3;
                posArr[ix + 2] = med.center.z + Math.sin(p.tentacleAngle) * baseR + waveZ;

                const pulseWave = 0.5 + 0.5 * Math.sin(elapsed * 6.0 - p.u * 8.0 + med.phase);
                const hue = (med.hueBase + 0.15 + pulseWave * 0.15 + elapsed * 0.05) % 1.0;
                tempCol.setHSL(hue, 0.95, 0.45 + pulseWave * 0.4);
            }

            colArr[ix] = tempCol.r;
            colArr[ix + 1] = tempCol.g;
            colArr[ix + 2] = tempCol.b;
        }

        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
    };
}

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

    const cCyan = new THREE.Color(0x22d3ee);
    const cTeal = new THREE.Color(0x2dd4bf);
    const cViolet = new THREE.Color(0xa855f7);
    const cPink = new THREE.Color(0xf43f5e);
    const cGold = new THREE.Color(0xfde047);

    const turns = 4.5;
    const heightSpan = 28.0;
    const helixRadius = 5.4;

    for (let i = 0; i < count; i++) {
        const u = i / count;
        const type = i < count * 0.55 ? 'backbone' : (i < count * 0.85 ? 'rung' : 'ambient');
        const strand = i % 2 === 0 ? 0 : Math.PI;
        const y = (u - 0.5) * heightSpan;
        const angle = u * Math.PI * 2.0 * turns;

        const rungStep = Math.floor(u * 36.0) / 36.0;
        const rungY = (rungStep - 0.5) * heightSpan;
        const rungAngle = rungStep * Math.PI * 2.0 * turns;
        const bridgeT = (Math.random() - 0.5) * 2.0;

        const jitterX = (Math.random() - 0.5) * 0.38;
        const jitterY = (Math.random() - 0.5) * 0.38;
        const jitterZ = (Math.random() - 0.5) * 0.38;

        meta.push({
            type, strand, y, angle, rungY, rungAngle, bridgeT,
            jitterX, jitterY, jitterZ,
            ambPos: new THREE.Vector3(
                (Math.random() - 0.5) * 24,
                (Math.random() - 0.5) * 26,
                (Math.random() - 0.5) * 18
            )
        });

        const c = new THREE.Color();
        if (type === 'backbone') {
            c.lerpColors(strand === 0 ? cCyan : cViolet, cTeal, 0.5 + 0.5 * Math.sin(angle));
        } else if (type === 'rung') {
            c.lerpColors(bridgeT > 0 ? cPink : cGold, cCyan, Math.abs(bridgeT) * 0.5);
        } else {
            c.lerpColors(cTeal, cViolet, Math.random());
        }

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.42,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const dnaPoints = new THREE.Points(geo, mat);
    dnaPoints.rotation.z = 0.28;
    root.add(dnaPoints);

    return function updateDNAHelix(dt, elapsed, energy) {
        mat.size = (0.42 + energy * 0.25) * state.intensity;
        const arr = geo.attributes.position.array;
        const twistSpeed = elapsed * 0.85;

        for (let i = 0; i < count; i++) {
            const m = meta[i];
            const ix = i * 3;

            if (m.type === 'backbone') {
                const a = m.angle + m.strand + twistSpeed;
                const unzip = 1.0 + state.clickStrength * 0.45 * Math.exp(-Math.pow((m.y * 0.15 - Math.sin(elapsed * 4.0)), 2));
                const r = (helixRadius * unzip) + Math.sin(elapsed * 2.0 + m.y * 0.4) * 0.25;
                arr[ix] = Math.cos(a) * r + m.jitterX;
                arr[ix + 1] = m.y + m.jitterY;
                arr[ix + 2] = Math.sin(a) * r + m.jitterZ;
            } else if (m.type === 'rung') {
                const a = m.rungAngle + twistSpeed;
                const unzip = 1.0 + state.clickStrength * 0.45 * Math.exp(-Math.pow((m.rungY * 0.15 - Math.sin(elapsed * 4.0)), 2));
                const r = helixRadius * unzip * m.bridgeT;
                const waveY = Math.sin(m.bridgeT * Math.PI + elapsed * 5.0) * 0.18 * (1 + energy * 2.0);
                arr[ix] = Math.cos(a) * r + m.jitterX * 0.4;
                arr[ix + 1] = m.rungY + waveY;
                arr[ix + 2] = Math.sin(a) * r + m.jitterZ * 0.4;
            } else {
                arr[ix] = m.ambPos.x + Math.sin(elapsed * 0.9 + i) * 0.8;
                arr[ix + 1] = m.ambPos.y + Math.cos(elapsed * 0.7 + i) * 0.8;
                arr[ix + 2] = m.ambPos.z;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

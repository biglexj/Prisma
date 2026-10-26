// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const count = 9500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const basePos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const cTeal = new THREE.Color(0x14b8a6);
    const cMagenta = new THREE.Color(0xd946ef);
    const cBlue = new THREE.Color(0x38bdf8);
    const cGold = new THREE.Color(0xfbbf24);

    for (let i = 0; i < count; i++) {
        const cluster = i % 5;
        const cx = Math.cos(cluster * 1.25) * 6.5;
        const cy = Math.sin(cluster * 1.25) * 4.5;
        const cz = (cluster - 2) * 2.5;

        const r = Math.pow(Math.random(), 0.85) * 9.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = cx + r * Math.sin(phi) * Math.cos(theta);
        const y = cy + r * Math.sin(phi) * Math.sin(theta);
        const z = cz + r * Math.cos(phi);

        pos[i * 3] = basePos[i * 3] = x;
        pos[i * 3 + 1] = basePos[i * 3 + 1] = y;
        pos[i * 3 + 2] = basePos[i * 3 + 2] = z;

        const c = new THREE.Color();
        if (cluster === 0) c.lerpColors(cTeal, cBlue, Math.random());
        else if (cluster === 1) c.lerpColors(cMagenta, cBlue, Math.random());
        else if (cluster === 2) c.lerpColors(cGold, cMagenta, Math.random());
        else c.lerpColors(cBlue, cTeal, Math.random());

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.65,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    root.add(new THREE.Points(geo, mat));

    const clouds = [];
    const cloudColors = [0x0d9488, 0x9333ea, 0x0284c7, 0xbe185d, 0x4f46e5];
    for (let i = 0; i < 24; i++) {
        const spMat = new THREE.SpriteMaterial({
            map: softGlowTex,
            color: cloudColors[i % cloudColors.length],
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        sp.position.set(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 10
        );
        const s = 9 + Math.random() * 10;
        sp.scale.set(s, s, 1);
        root.add(sp);
        clouds.push({ sp, baseScale: s, phase: Math.random() * Math.PI * 2 });
    }

    return function updateNebula(dt, elapsed, energy) {
        mat.size = (0.65 + energy * 0.35) * state.intensity;
        clouds.forEach(c => {
            const s = c.baseScale * (1.0 + Math.sin(elapsed * 1.5 + c.phase) * 0.08 + energy * 0.22);
            c.sp.scale.set(s, s, 1);
        });

        const localClick = state.clickWorldPos.clone().sub(masterGroup.position);
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
            const ix = i * 3;
            const bx = basePos[ix], by = basePos[ix + 1], bz = basePos[ix + 2];
            const wave = Math.sin(elapsed * 0.8 + bx * 0.25) * 0.45;
            let px = bx + wave;
            let py = by + Math.cos(elapsed * 0.7 + by * 0.25) * 0.45;
            let pz = bz;

            if (state.clickStrength > 0.02) {
                const dx = px - localClick.x;
                const dy = py - localClick.y;
                const dz = pz - localClick.z;
                const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.5;
                const shock = Math.sin(d * 1.2 - elapsed * 14.0) * state.clickStrength * (4.0 / d);
                px += (dx / d) * shock;
                py += (dy / d) * shock;
                pz += (dz / d) * shock;
            }

            arr[ix] = px;
            arr[ix + 1] = py;
            arr[ix + 2] = pz;
        }
        geo.attributes.position.needsUpdate = true;
    };
}

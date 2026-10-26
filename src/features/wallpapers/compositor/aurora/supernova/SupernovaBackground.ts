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
    const meta = [];

    const cCore = new THREE.Color(0xe0f2fe);
    const cSynchrotron = new THREE.Color(0x38bdf8);
    const cFilamentOrange = new THREE.Color(0xf97316);
    const cFilamentRose = new THREE.Color(0xf43f5e);

    for (let i = 0; i < count; i++) {
        const isBeam = i < count * 0.25;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const harmonic = 1.0 + 0.35 * Math.sin(theta * 5.0) * Math.cos(phi * 4.0);
        const baseR = isBeam
            ? Math.random() * 19.0
            : (5.5 + Math.pow(Math.random(), 0.7) * 9.5) * harmonic;

        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );

        meta.push({
            isBeam,
            pole: i % 2 === 0 ? 1 : -1,
            beamDist: baseR,
            beamAngle: theta,
            dir,
            baseR
        });

        const c = new THREE.Color();
        if (isBeam) {
            c.lerpColors(cCore, cSynchrotron, baseR / 19.0);
        } else {
            const t = (baseR - 4.0) / 13.0;
            if (t < 0.45) c.lerpColors(cSynchrotron, cFilamentOrange, Math.max(0, t / 0.45));
            else c.lerpColors(cFilamentOrange, cFilamentRose, Math.min(1, (t - 0.45) / 0.55));
        }

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.44,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const remnant = new THREE.Points(geo, mat);
    root.add(remnant);

    return function updateSupernova(dt, elapsed, energy) {
        mat.size = (0.44 + energy * 0.28) * state.intensity;
        const arr = geo.attributes.position.array;
        const pulsarSpin = elapsed * 3.2;

        for (let i = 0; i < count; i++) {
            const m = meta[i];
            const ix = i * 3;
            if (m.isBeam) {
                m.beamDist = (m.beamDist + dt * 14.0 * (1 + energy)) % 19.0;
                const coneSpread = 0.15 + m.beamDist * 0.08;
                const bx = Math.cos(m.beamAngle + pulsarSpin) * coneSpread;
                const by = m.pole * m.beamDist;
                const bz = Math.sin(m.beamAngle + pulsarSpin) * coneSpread;
                const tilt = 0.6;
                const ty = by * Math.cos(tilt) - bz * Math.sin(tilt);
                const tz = by * Math.sin(tilt) + bz * Math.cos(tilt);
                arr[ix] = bx * Math.cos(pulsarSpin) + tz * Math.sin(pulsarSpin);
                arr[ix + 1] = ty;
                arr[ix + 2] = -bx * Math.sin(pulsarSpin) + tz * Math.cos(pulsarSpin);
            } else {
                const breathe = 1.0 + Math.sin(elapsed * 1.2 + m.baseR * 0.5) * 0.06 + state.clickStrength * 0.35;
                const r = m.baseR * breathe;
                arr[ix] = m.dir.x * r;
                arr[ix + 1] = m.dir.y * r;
                arr[ix + 2] = m.dir.z * r;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

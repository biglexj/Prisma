// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const lines = 48;
    const ptsPerLine = 220;
    const count = lines * ptsPerLine;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let l = 0; l < lines; l++) {
        for (let p = 0; p < ptsPerLine; p++) {
            const idx = (l * ptsPerLine + p) * 3;
            pos[idx] = ((p / (ptsPerLine - 1)) - 0.5) * 36.0;
            pos[idx + 1] = 0;
            pos[idx + 2] = ((l / (lines - 1)) - 0.5) * 24.0;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.42,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const waveField = new THREE.Points(geo, mat);
    waveField.rotation.x = 0.28;
    root.add(waveField);

    const tempCol = new THREE.Color();

    return function updateSoundWave(dt, elapsed, energy) {
        mat.size = (0.42 + energy * 0.32) * state.intensity;
        const posArr = geo.attributes.position.array;
        const colArr = geo.attributes.color.array;
        const pulseAmp = 1.0 + energy * 2.8 + state.clickStrength * 2.2;

        for (let l = 0; l < lines; l++) {
            const zNorm = (l / (lines - 1)) - 0.5;
            const z = zNorm * 24.0;

            for (let p = 0; p < ptsPerLine; p++) {
                const idx = (l * ptsPerLine + p) * 3;
                const xNorm = (p / (ptsPerLine - 1)) - 0.5;
                const x = xNorm * 36.0;

                const distCenter = Math.sqrt(x * x + z * z);
                const radialBeat = Math.sin(distCenter * 0.65 - elapsed * 6.5) * Math.exp(-distCenter * 0.06);
                const harmonic = Math.sin(x * 0.35 + elapsed * 3.2) * Math.cos(z * 0.4 - elapsed * 2.4);
                const eqPeak = Math.sin(p * 0.25 + elapsed * 8.0) * Math.exp(-Math.abs(zNorm) * 3.5) * (0.4 + energy * 1.8);

                const y = (radialBeat * 2.8 + harmonic * 1.2 + eqPeak) * pulseAmp;
                posArr[idx + 1] = y;

                const hue = (0.52 + xNorm * 0.35 + y * 0.04 + elapsed * 0.08) % 1.0;
                const lightness = Math.min(0.85, 0.45 + Math.abs(y) * 0.08 + energy * 0.2);
                tempCol.setHSL((hue + 1.0) % 1.0, 0.92, lightness);

                colArr[idx] = tempCol.r;
                colArr[idx + 1] = tempCol.g;
                colArr[idx + 2] = tempCol.b;
            }
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
    };
}

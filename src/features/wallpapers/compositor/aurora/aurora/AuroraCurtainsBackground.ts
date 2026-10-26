// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const curtains = 9;
    const colsPerCurtain = 75;
    const rowsPerCol = 18;
    const count = curtains * colsPerCurtain * rowsPerCol;

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.68,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    root.add(new THREE.Points(geo, mat));
    const tempCol = new THREE.Color();

    return function updateAurora(dt, elapsed, energy) {
        mat.size = (0.68 + energy * 0.35) * state.intensity;
        const posArr = geo.attributes.position.array;
        const colArr = geo.attributes.color.array;

        let idx = 0;
        for (let c = 0; c < curtains; c++) {
            const baseZ = (c - (curtains - 1) * 0.5) * 2.6;
            const curtainPhase = c * 0.85;

            for (let xIdx = 0; xIdx < colsPerCurtain; xIdx++) {
                const u = (xIdx / (colsPerCurtain - 1)) - 0.5;
                const baseX = u * 34.0;
                const ribbonWave = Math.sin(u * 6.5 + elapsed * 1.1 + curtainPhase) * 2.6
                                 + Math.cos(u * 11.0 - elapsed * 0.8) * 1.1;

                for (let yIdx = 0; yIdx < rowsPerCol; yIdx++) {
                    const v = yIdx / (rowsPerCol - 1);
                    const y = (v - 0.45) * 16.0 + Math.sin(u * 4.0 + elapsed * 1.5 + c) * 1.8;
                    const drapeSway = Math.sin(v * 3.2 - elapsed * 2.2 + u * 5.0) * (1.2 + energy * 1.8);

                    posArr[idx] = baseX + drapeSway * 0.4;
                    posArr[idx + 1] = y;
                    posArr[idx + 2] = baseZ + ribbonWave + drapeSway;

                    const hue = (0.36 + v * 0.42 + c * 0.06 + elapsed * 0.09) % 1.0;
                    const lum = (1.0 - Math.abs(v - 0.35)) * (0.55 + energy * 0.25);
                    tempCol.setHSL(hue, 0.95, Math.max(0.2, Math.min(0.85, lum)));

                    colArr[idx] = tempCol.r;
                    colArr[idx + 1] = tempCol.g;
                    colArr[idx + 2] = tempCol.b;
                    idx += 3;
                }
            }
        }

        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
    };
}

// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/** Extraído de la referencia normal del motor VTuber.
 * @param {import('three').Group} root
 * @param {import('../ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup, squareTex }) {
    const nodeCount = 46;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
        nodes.push(new THREE.Vector3(
            (Math.random() - 0.5) * 28,
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 14
        ));
    }

    const edges = [];
    const linePositions = [];
    const lineColors = [];
    const cBase = new THREE.Color(0x38bdf8);

    for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
            const dist = nodes[i].distanceTo(nodes[j]);
            if (dist < 8.8) {
                edges.push({ a: i, b: j });
                linePositions.push(nodes[i].x, nodes[i].y, nodes[i].z);
                linePositions.push(nodes[j].x, nodes[j].y, nodes[j].z);
                lineColors.push(cBase.r * 0.35, cBase.g * 0.35, cBase.b * 0.35);
                lineColors.push(cBase.r * 0.35, cBase.g * 0.35, cBase.b * 0.35);
            }
        }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending
    });
    root.add(new THREE.LineSegments(lineGeo, lineMat));

    const pulseCount = 4500;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pulseCount * 3);
    const pCol = new Float32Array(pulseCount * 3);
    const pMeta = [];

    for (let i = 0; i < pulseCount; i++) {
        const edgeIdx = i % Math.max(1, edges.length);
        pMeta.push({
            edgeIdx,
            t: Math.random(),
            speed: 0.45 + Math.random() * 1.35,
            dir: i % 2 === 0 ? 1 : -1,
            jitter: (Math.random() - 0.5) * 0.22
        });
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

    const pMat = new THREE.PointsMaterial({
        size: 0.48,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    root.add(new THREE.Points(pGeo, pMat));
    const tempCol = new THREE.Color();

    return function updateSynapse(dt, elapsed, energy) {
        pMat.size = (0.48 + energy * 0.3) * state.intensity;
        const posArr = pGeo.attributes.position.array;
        const colArr = pGeo.attributes.color.array;

        for (let i = 0; i < pulseCount; i++) {
            const m = pMeta[i];
            const edge = edges[m.edgeIdx];
            if (!edge) continue;

            m.t += dt * m.speed * m.dir * (1.0 + energy * 1.4 + state.clickStrength * 2.0);
            if (m.t > 1.0) m.t -= 1.0;
            if (m.t < 0.0) m.t += 1.0;

            const nA = nodes[edge.a];
            const nB = nodes[edge.b];
            const ix = i * 3;

            const arc = Math.sin(m.t * Math.PI) * m.jitter;
            posArr[ix] = THREE.MathUtils.lerp(nA.x, nB.x, m.t);
            posArr[ix + 1] = THREE.MathUtils.lerp(nA.y, nB.y, m.t) + arc;
            posArr[ix + 2] = THREE.MathUtils.lerp(nA.z, nB.z, m.t);

            const spark = Math.sin(m.t * Math.PI);
            const hue = (0.08 + m.t * 0.15 + elapsed * 0.08 + (i % 5) * 0.12) % 1.0;
            tempCol.setHSL(hue, 0.95, 0.45 + spark * 0.45);

            colArr[ix] = tempCol.r;
            colArr[ix + 1] = tempCol.g;
            colArr[ix + 2] = tempCol.b;
        }

        pGeo.attributes.position.needsUpdate = true;
        pGeo.attributes.color.needsUpdate = true;
    };
}

// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/** Extraído de la referencia normal del motor VTuber.
 * @param {import('three').Group} root
 * @param {import('../ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup, squareTex }) {
    const tunnelGroup = new THREE.Group();
    root.add(tunnelGroup);

    const ringCount = 24;
    const radialSegments = 24;
    const rings = [];
    const cTeal = new THREE.Color(0x14b8a6);
    const cPink = new THREE.Color(0xf472b6);

    // Rayos longitudinales centrados directamente frente a la cámara
    const spokePositions = [];
    const spokeColors = [];
    for (let s = 0; s < radialSegments; s++) {
        const a = (s / radialSegments) * Math.PI * 2;
        const x = Math.cos(a) * 12.2;
        const y = Math.sin(a) * 12.2;
        const col = new THREE.Color().lerpColors(cTeal, cPink, (Math.cos(a) + 1) * 0.5);
        spokePositions.push(x, y, 16, x * 0.08, y * 0.08, -62);
        spokeColors.push(col.r, col.g, col.b, col.r * 0.2, col.g * 0.2, col.b * 0.2);
    }
    const spokeGeo = new THREE.BufferGeometry();
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePositions, 3));
    spokeGeo.setAttribute('color', new THREE.Float32BufferAttribute(spokeColors, 3));
    const spokeMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
    });
    tunnelGroup.add(new THREE.LineSegments(spokeGeo, spokeMat));

    // Anillos concéntricos perfectamente alineados de frente
    for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const ringGeo = new THREE.RingGeometry(11.35, 12.15, radialSegments);
        const cols = [];
        const posAttr = ringGeo.attributes.position;
        for (let k = 0; k < posAttr.count; k++) {
            const vx = posAttr.getX(k);
            const t = (vx / 12.15 + 1.0) * 0.5;
            const c = new THREE.Color().lerpColors(cTeal, cPink, t);
            cols.push(c.r, c.g, c.b);
        }
        ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        const ringMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(ringGeo, ringMat);
        const zPos = 14.0 - rIdx * 3.1;
        mesh.position.z = zPos;
        tunnelGroup.add(mesh);
        rings.push({ mesh, mat: ringMat, z: zPos });
    }

    // Píxeles cuánticos cuadrados flotando desde el fondo del túnel
    const pixCount = 340;
    const pixGeo = new THREE.BufferGeometry();
    const pixPos = new Float32Array(pixCount * 3);
    const pixCol = new Float32Array(pixCount * 3);
    for (let i = 0; i < pixCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const rad = 2.0 + Math.random() * 10.2;
        pixPos[i * 3] = Math.cos(a) * rad;
        pixPos[i * 3 + 1] = Math.sin(a) * rad;
        pixPos[i * 3 + 2] = 14.0 - Math.random() * 72;
        const c = i % 2 === 0 ? cTeal : cPink;
        pixCol[i * 3] = c.r;
        pixCol[i * 3 + 1] = c.g;
        pixCol[i * 3 + 2] = c.b;
    }
    pixGeo.setAttribute('position', new THREE.BufferAttribute(pixPos, 3));
    pixGeo.setAttribute('color', new THREE.BufferAttribute(pixCol, 3));
    const pixMat = new THREE.PointsMaterial({
        size: 0.65,
        map: squareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    tunnelGroup.add(new THREE.Points(pixGeo, pixMat));

    return function updateNeonTunnel(dt, elapsed, energy) {
        const speed = 11.5 * (1.0 + energy * 1.4 + state.clickStrength * 1.8);
        // Giro axial frontal puro sobre Z para mantener el centro del túnel siempre de frente
        tunnelGroup.rotation.z = elapsed * 0.22;

        rings.forEach((r) => {
            r.z += dt * speed;
            if (r.z > 16.0) r.z -= ringCount * 3.1;
            r.mesh.position.z = r.z;
            const distFromFront = Math.max(0, (16.0 - r.z) / (ringCount * 3.1));
            r.mat.opacity = Math.max(0.04, (1.0 - distFromFront) * 0.85 * state.intensity);
        });

        const pArr = pixGeo.attributes.position.array;
        for (let i = 0; i < pixCount; i++) {
            pArr[i * 3 + 2] += dt * speed * 1.3;
            if (pArr[i * 3 + 2] > 16.0) pArr[i * 3 + 2] = -58.0;
        }
        pixGeo.attributes.position.needsUpdate = true;
    };
}

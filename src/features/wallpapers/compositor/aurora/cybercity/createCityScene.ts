// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/** Extraído de la referencia normal del motor VTuber.
 * @param {import('three').Group} root
 * @param {import('../ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup, squareTex }) {
    const cityGroup = new THREE.Group();
    cityGroup.position.set(0, -5.5, -4);
    cityGroup.rotation.x = 0.18;
    cityGroup.rotation.y = -0.38;
    root.add(cityGroup);

    const cTeal = new THREE.Color(0x14b8a6);
    const cPink = new THREE.Color(0xf472b6);

    // Grilla de suelo holográfica
    const gridLines = [];
    const gridCols = [];
    const gridSize = 44;
    const step = 2.2;
    for (let i = -gridSize; i <= gridSize; i += step) {
        const t = (i + gridSize) / (gridSize * 2);
        const c = new THREE.Color().lerpColors(cPink, cTeal, t);
        gridLines.push(-gridSize, 0, i, gridSize, 0, i);
        gridCols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        gridLines.push(i, 0, -gridSize, i, 0, gridSize);
        gridCols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridLines, 3));
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(gridCols, 3));
    const floorMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
    });
    cityGroup.add(new THREE.LineSegments(floorGeo, floorMat));

    // Edificios Wireframe 3D
    const buildings = [];
    for (let b = 0; b < 38; b++) {
        const w = 1.4 + Math.random() * 2.2;
        const d = 1.4 + Math.random() * 2.2;
        const h = 3.5 + Math.pow(Math.random(), 1.3) * 16.5;
        const boxGeo = new THREE.BoxGeometry(w, h, d);
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        boxGeo.dispose();
        const isTeal = b % 2 === 0;
        const bMat = new THREE.LineBasicMaterial({
            color: isTeal ? 0x2dd4bf : 0xf472b6,
            transparent: true,
            opacity: 0.62,
            blending: THREE.AdditiveBlending
        });
        const wireframe = new THREE.LineSegments(edgesGeo, bMat);
        const bx = (Math.random() - 0.5) * 34;
        const bz = (Math.random() - 0.5) * 28;
        wireframe.position.set(bx, h * 0.5, bz);
        cityGroup.add(wireframe);
        buildings.push({ mesh: wireframe, mat: bMat, baseH: h, phase: b * 0.5 });
    }

    // Paquetes de luz vertical ascendiendo por las torres
    const packetCount = 450;
    const pkGeo = new THREE.BufferGeometry();
    const pkPos = new Float32Array(packetCount * 3);
    const pkCol = new Float32Array(packetCount * 3);
    for (let i = 0; i < packetCount; i++) {
        pkPos[i * 3] = (Math.random() - 0.5) * 34;
        pkPos[i * 3 + 1] = Math.random() * 18;
        pkPos[i * 3 + 2] = (Math.random() - 0.5) * 28;
        const c = i % 3 === 0 ? new THREE.Color(0xfef08a) : (i % 2 === 0 ? cTeal : cPink);
        pkCol[i * 3] = c.r;
        pkCol[i * 3 + 1] = c.g;
        pkCol[i * 3 + 2] = c.b;
    }
    pkGeo.setAttribute('position', new THREE.BufferAttribute(pkPos, 3));
    pkGeo.setAttribute('color', new THREE.BufferAttribute(pkCol, 3));
    const pkMat = new THREE.PointsMaterial({
        size: 0.42,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    cityGroup.add(new THREE.Points(pkGeo, pkMat));

    return function updateHoloCity(dt, elapsed, energy) {
        buildings.forEach((b) => {
            const pulse = 1.0 + Math.sin(elapsed * 2.0 + b.phase) * 0.06 + energy * 0.25 + state.clickStrength * 0.3;
            b.mesh.scale.y = pulse;
            b.mesh.position.y = (b.baseH * pulse) * 0.5;
            b.mat.opacity = Math.min(0.95, (0.52 + energy * 0.35) * state.intensity);
        });

        const arr = pkGeo.attributes.position.array;
        for (let i = 0; i < packetCount; i++) {
            arr[i * 3 + 1] += dt * (4.5 + (i % 5)) * (1.0 + energy + state.clickStrength);
            if (arr[i * 3 + 1] > 20.0) arr[i * 3 + 1] = 0.0;
        }
        pkGeo.attributes.position.needsUpdate = true;
    };
}

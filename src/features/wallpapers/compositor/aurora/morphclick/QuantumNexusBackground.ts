// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const count = 12000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const shapes = [[], [], [], []];

    const cTeal = new THREE.Color(0x2dd4bf);
    const cSky = new THREE.Color(0x38bdf8);
    const cPurple = new THREE.Color(0xc084fc);

    for (let i = 0; i < count; i++) {
        const u = i / count;
        const theta = i * 2.3999632;
        const phi = Math.acos(1 - 2 * u);

        // Shape 0: Dyson Quantum Sphere with equatorial rings
        if (i < 8500) {
            const r = 9.2 + (i % 3) * 0.45;
            shapes[0].push(new THREE.Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            ));
        } else {
            const ringR = 12.0 + Math.random() * 3.5;
            const a = Math.random() * Math.PI * 2;
            shapes[0].push(new THREE.Vector3(Math.cos(a) * ringR, (Math.random() - 0.5) * 0.4, Math.sin(a) * ringR));
        }

        // Shape 1: Magnetic Tokamak Torus Knot
        const p = 3, q = 7;
        const tKnot = u * Math.PI * 2 * 4;
        const rKnot = 7.5 + 3.2 * Math.cos(q * tKnot);
        shapes[1].push(new THREE.Vector3(
            rKnot * Math.cos(p * tKnot) + (Math.random() - 0.5) * 0.6,
            rKnot * Math.sin(p * tKnot) + (Math.random() - 0.5) * 0.6,
            3.2 * Math.sin(q * tKnot) + (Math.random() - 0.5) * 0.6
        ));

        // Shape 2: Twin Cosmic Helix
        const strand = i % 2 === 0 ? 1 : -1;
        const hY = (u - 0.5) * 24.0;
        const hAngle = u * Math.PI * 10.0 + (strand > 0 ? 0 : Math.PI);
        const hR = (i % 7 === 0) ? Math.random() * 5.5 : 5.5;
        shapes[2].push(new THREE.Vector3(
            Math.cos(hAngle) * hR,
            hY,
            Math.sin(hAngle) * hR
        ));

        // Shape 3: Octahedral Starburst Lattice
        const latR = 11.5 * Math.pow(Math.random(), 0.7);
        shapes[3].push(new THREE.Vector3(
            latR * Math.pow(Math.sin(phi) * Math.cos(theta), 3),
            latR * Math.pow(Math.sin(phi) * Math.sin(theta), 3),
            latR * Math.pow(Math.cos(phi), 3)
        ).multiplyScalar(1.45));

        const initV = shapes[0][i];
        pos[i * 3] = initV.x;
        pos[i * 3 + 1] = initV.y;
        pos[i * 3 + 2] = initV.z;

        const c = new THREE.Color();
        if (u < 0.5) c.lerpColors(cTeal, cSky, u * 2);
        else c.lerpColors(cSky, cPurple, (u - 0.5) * 2);

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.38,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    root.add(points);

    return function updateMorphClick(dt, elapsed, energy) {
        mat.size = (0.38 + energy * 0.25) * state.intensity;
        const targetList = shapes[state.morphShapeIndex % shapes.length];
        const arr = geo.attributes.position.array;
        const localClick = state.clickWorldPos.clone().sub(masterGroup.position);

        for (let i = 0; i < count; i++) {
            const target = targetList[i];
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

            let tx = target.x + Math.sin(elapsed * 1.5 + i * 0.01) * 0.18;
            let ty = target.y + Math.cos(elapsed * 1.3 + i * 0.01) * 0.18;
            let tz = target.z;

            if (state.clickStrength > 0.02) {
                const dx = localClick.x - arr[ix];
                const dy = localClick.y - arr[iy];
                const dz = localClick.z - arr[iz];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
                const pull = Math.min(1.0, 12.0 / (dist * dist)) * state.clickStrength;
                tx += dx * pull * 0.85 + Math.sin(dist * 2.0 - elapsed * 12.0) * state.clickStrength * 1.2;
                ty += dy * pull * 0.85 + Math.cos(dist * 2.0 - elapsed * 12.0) * state.clickStrength * 1.2;
                tz += dz * pull * 0.5;
            }

            arr[ix] += (tx - arr[ix]) * Math.min(1, dt * 4.2);
            arr[iy] += (ty - arr[iy]) * Math.min(1, dt * 4.2);
            arr[iz] += (tz - arr[iz]) * Math.min(1, dt * 4.2);
        }
        geo.attributes.position.needsUpdate = true;
    };
}

// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';

/** Libera una escena local sin destruir texturas prestadas por su adaptador. */
export function disposeBackgroundObjects(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse(object => {
        const drawable = object as THREE.Mesh;
        if (drawable.geometry && !(object instanceof THREE.Sprite)) geometries.add(drawable.geometry);
        if (drawable.material) {
            for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) materials.add(material);
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    root.removeFromParent();
    root.clear();
}

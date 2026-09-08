import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLACEMENTS } from './data/vehicle';
import { roleOf } from './finishes';

/** The authored modules share one AO atlas, so duplicate role materials can share a draw. */
export function batchByRole(root: THREE.Object3D): number {
  const owners = new Set([...PLACEMENTS.filter((p) => p.movable).map((p) => p.id), 'slideout_box']);
  const buckets = new Map<THREE.Object3D, Map<string, THREE.Mesh[]>>();
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    // GLTFLoader represents each multi-material primitive as its own child mesh.
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material) || !node.geometry.getAttribute('position')) return;
    const role = roleOf(node.material.name);
    if (!role) return;
    let owner: THREE.Object3D = node;
    while (owner !== root && !owners.has(owner.name)) owner = owner.parent!;
    if (!buckets.has(owner)) buckets.set(owner, new Map());
    const roles = buckets.get(owner)!;
    if (!roles.has(role)) roles.set(role, []);
    roles.get(role)!.push(node);
  });

  let count = 0;
  for (const [owner, roles] of buckets) {
    const inverse = owner.matrixWorld.clone().invert();
    for (const [role, meshes] of roles) {
      const needsTangents = meshes.some((mesh) => mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.normalMap);
      const geometries = meshes.map((mesh) => {
        const geometry = mesh.geometry.clone();
        // Blender omits tangents on some primitives; AO needs only UVs.
        if (!needsTangents) geometry.deleteAttribute('tangent');
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
        if (needsTangents && !geometry.getAttribute('tangent')) geometry.computeTangents();
        const transform = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
        geometry.applyMatrix4(transform);
        // Baking a reflection loses the renderer's automatic front-face reversal.
        if (transform.determinant() < 0) {
          const index = geometry.index!;
          for (let i = 0; i < index.count; i += 3) {
            const second = index.getX(i + 1);
            index.setX(i + 1, index.getX(i + 2));
            index.setX(i + 2, second);
          }
          const tangent = geometry.getAttribute('tangent');
          if (tangent) for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i));
        }
        return geometry;
      });
      const geometry = mergeGeometries(geometries);
      for (const source of geometries) source.dispose();
      if (!geometry) throw new Error(`Cannot merge geometry attributes for role.${role}`);
      const batch = new THREE.Mesh(geometry, meshes[0]!.material);
      batch.name = `batch.${role}`;
      batch.castShadow = meshes.some((mesh) => mesh.castShadow);
      batch.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
      // Keep original nodes and identity for bindPlacements, while removing their draws.
      for (const mesh of meshes) mesh.geometry = new THREE.BufferGeometry();
      owner.add(batch);
      count++;
    }
  }
  return count;
}

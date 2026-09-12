import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLACEMENTS } from './data/vehicle';
import { roleOf } from './finishes';
import { DEFAULT_REGISTRY, type Registry, type Role } from './data/finishes';


/**
 * `computeTangents()` returns a zero-length tangent for any triangle whose UV island has no area —
 * a seam the re-unwrap collapsed, or a face `smart_project` gave a single UV. Three does not treat
 * that as an error, but the shader normalises the TBN, and normalising a zero vector is NaN. Those
 * NaN fragments then reach `refreshProbe()`'s cubemap capture, and every material lit by that
 * environment renders black: one collapsed island on a cabinet door blacks the whole cabin.
 *
 * Substituting any unit vector orthogonal to the normal is correct enough — the triangle has no UV
 * area, so nothing samples a map across it, and only the TBN's validity matters.
 */
function repairTangents(geometry: THREE.BufferGeometry): number {
  const tangent = geometry.getAttribute('tangent');
  const normal = geometry.getAttribute('normal');
  if (!tangent || !normal) return 0;
  const n = new THREE.Vector3(), axis = new THREE.Vector3(), t = new THREE.Vector3();
  let repaired = 0;
  for (let i = 0; i < tangent.count; i++) {
    t.set(tangent.getX(i), tangent.getY(i), tangent.getZ(i));
    if (Number.isFinite(t.lengthSq()) && t.lengthSq() > 1e-12) continue;
    n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    axis.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0);
    t.crossVectors(n, axis).normalize();
    if (!Number.isFinite(t.lengthSq()) || t.lengthSq() < 1e-12) t.set(1, 0, 0);
    tangent.setXYZ(i, t.x, t.y, t.z);
    repaired++;
  }
  return repaired;
}

/** The authored modules share one AO atlas, so duplicate role materials can share a draw. */
export function batchByRole(root: THREE.Object3D, registry: Registry = DEFAULT_REGISTRY): number {
  const owners = new Set([...PLACEMENTS.filter((p) => p.movable).map((p) => p.id), 'slideout_box']);
  const buckets = new Map<THREE.Object3D, Map<Role, THREE.Mesh[]>>();
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
      const needsTangents = registry[role].variants.some((v) => v.params.normalMap);
      const geometries = meshes.map((mesh) => {
        const geometry = mesh.geometry.clone();
        // Blender omits tangents on some primitives; AO needs only UVs.
        if (!needsTangents) geometry.deleteAttribute('tangent');
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
        if (needsTangents && !geometry.getAttribute('tangent')) {
          geometry.computeTangents();
          repairTangents(geometry);
        }
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

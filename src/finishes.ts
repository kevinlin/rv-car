import * as THREE from 'three';
import { ALL_ROLES, DEFAULT_REGISTRY, type Registry, type Role } from './data/finishes';

const ROLE_SET = new Set<string>(ALL_ROLES);

/**
 * `role.wood.cabinet` -> `wood.cabinet`.
 * Blender appends `.001` to duplicated material names, so a trailing numeric suffix is stripped
 * before the lookup. Returns null for anything that is not a known role.
 */
export const roleOf = (materialName: string): Role | null => {
  if (!materialName.startsWith('role.')) return null;
  const body = materialName.slice('role.'.length).replace(/\.\d{3}$/, '');
  return ROLE_SET.has(body) ? (body as Role) : null;
};

/** Applies the active variant of each role to every matching mesh. Returns how many it restyled. */
export const applyFinishes = (
  root: THREE.Object3D,
  registry: Registry = DEFAULT_REGISTRY,
): number => {
  let restyled = 0;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      const role = roleOf(material.name);
      if (!role) continue;

      const slot = registry[role];
      const variant = slot.variants.find((v) => v.id === slot.active);
      if (!variant) continue;

      const p = variant.params;
      material.color.setHex(p.color);
      material.roughness = p.roughness;
      material.metalness = p.metalness;
      material.emissive.setHex(p.emissive ?? 0x000000);
      material.emissiveIntensity = p.emissiveIntensity ?? 1;
      // The baked AO shares one 2048 atlas across 29 objects, so the large shell surfaces get
      // few texels and read as blotches at full strength. Held back to contact shading only.
      material.aoMapIntensity = 0.4;
      material.needsUpdate = true;
      restyled++;
    }
  });

  return restyled;
};

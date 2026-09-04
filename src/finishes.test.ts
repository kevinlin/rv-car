import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_REGISTRY, type Role } from './data/finishes';
import { roleOf, applyFinishes } from './finishes';

const meshWithMaterial = (materialName: string): THREE.Mesh => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ name: materialName, color: 0x000000 }),
  );
  m.name = `mesh_${materialName}`;
  return m;
};

describe('roleOf', () => {
  it('strips the role prefix', () => {
    expect(roleOf('role.wood.cabinet')).toBe('wood.cabinet');
    expect(roleOf('role.upholstery.seat')).toBe('upholstery.seat');
  });

  it('returns null for an unprefixed name', () => {
    expect(roleOf('Walnut.001')).toBeNull();
  });

  it('returns null for a prefixed name that is not a known role', () => {
    expect(roleOf('role.not.a.real.role')).toBeNull();
  });

  it('tolerates Blender duplicate suffixes', () => {
    expect(roleOf('role.wood.cabinet.001')).toBe('wood.cabinet');
  });
});

describe('DEFAULT_REGISTRY', () => {
  it('gives every role at least one variant', () => {
    for (const role of Object.keys(DEFAULT_REGISTRY) as Role[]) {
      expect(DEFAULT_REGISTRY[role].variants.length).toBeGreaterThan(0);
    }
  });

  it('points every active id at a real variant', () => {
    for (const role of Object.keys(DEFAULT_REGISTRY) as Role[]) {
      const { active, variants } = DEFAULT_REGISTRY[role];
      expect(variants.some((v) => v.id === active)).toBe(true);
    }
  });

  it('offers three wood variants as the shipped proof of the seam', () => {
    expect(DEFAULT_REGISTRY['wood.cabinet'].variants.map((v) => v.id))
      .toEqual(['walnut', 'oak', 'ash']);
  });
});

describe('applyFinishes', () => {
  it('restyles every mesh whose material carries a known role', () => {
    const root = new THREE.Group();
    root.add(meshWithMaterial('role.wood.cabinet'));
    root.add(meshWithMaterial('role.worktop'));
    expect(applyFinishes(root)).toBe(2);
  });

  it('applies the active variant colour', () => {
    const root = new THREE.Group();
    const mesh = meshWithMaterial('role.wood.cabinet');
    root.add(mesh);
    applyFinishes(root);
    const expected = DEFAULT_REGISTRY['wood.cabinet'].variants
      .find((v) => v.id === DEFAULT_REGISTRY['wood.cabinet'].active)!.params.color;
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(expected);
  });

  it('changes only wood surfaces when the wood variant changes', () => {
    const root = new THREE.Group();
    const wood = meshWithMaterial('role.wood.cabinet');
    const top = meshWithMaterial('role.worktop');
    root.add(wood, top);
    applyFinishes(root);
    const topBefore = (top.material as THREE.MeshStandardMaterial).color.getHex();

    const swapped = structuredClone(DEFAULT_REGISTRY);
    swapped['wood.cabinet'].active = 'oak';
    applyFinishes(root, swapped);

    const oak = swapped['wood.cabinet'].variants.find((v) => v.id === 'oak')!;
    expect((wood.material as THREE.MeshStandardMaterial).color.getHex()).toBe(oak.params.color);
    expect((top.material as THREE.MeshStandardMaterial).color.getHex()).toBe(topBefore);
  });

  it('leaves meshes with unrecognised materials untouched', () => {
    const root = new THREE.Group();
    const stray = meshWithMaterial('Material.042');
    root.add(stray);
    expect(applyFinishes(root)).toBe(0);
    expect((stray.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x000000);
  });
});

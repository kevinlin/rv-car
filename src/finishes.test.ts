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
  it('resets inherited GLTFLoader transparency, opacity and depth writes', () => {
    const material = new THREE.MeshStandardMaterial({
      name: 'role.glass', transparent: true, opacity: 0.24, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    applyFinishes(mesh);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.opacity).toBe(1);

    material.name = 'role.body.graphic';
    applyFinishes(mesh);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBe(1);
  });

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

describe('texture resolution', () => {
  it('assigns a resolved texture to the material map', () => {
    const mesh = meshWithMaterial('role.floor');
    const registry = structuredClone(DEFAULT_REGISTRY);
    // Variant.params is readonly, so the variant is replaced rather than mutated.
    registry['floor'].variants[0] = {
      ...registry['floor'].variants[0]!,
      params: {
        ...registry['floor'].variants[0]!.params,
        map: { url: '/textures/herringbone.webp', repeat: [4, 8] },
      },
    };

    const texture = new THREE.Texture();
    applyFinishes(mesh, registry, () => texture);

    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(texture);
  });

  it('leaves an existing map alone when the registry supplies none', () => {
    // The .glb-authored maps must survive until the registry replaces them role by role.
    // metal.chrome rather than floor: floor now carries a map, and a polished metal is the
    // role least likely to acquire one later and quietly turn this test green for free.
    const mesh = meshWithMaterial('role.metal.chrome');
    const existing = new THREE.Texture();
    (mesh.material as THREE.MeshStandardMaterial).map = existing;

    applyFinishes(mesh, DEFAULT_REGISTRY, () => new THREE.Texture());

    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(existing);
  });

  it('defaults to no resolver, so node tests need no WebGL context', () => {
    const mesh = meshWithMaterial('role.floor');
    expect(() => applyFinishes(mesh, DEFAULT_REGISTRY)).not.toThrow();
  });
});

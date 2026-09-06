import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { bindPlacements, BindingError } from './binding';
import { PLACEMENTS } from './data/vehicle';

const treeWith = (names: string[]): THREE.Object3D => {
  const root = new THREE.Group();
  for (const n of names) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    o.name = n;
    root.add(o);
  }
  return root;
};

describe('bindPlacements', () => {
  it('returns a node for every placement it is given', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    const map = bindPlacements(treeWith(subset.map((p) => p.id)), subset);
    expect(map.size).toBe(subset.length);
    expect(map.get('dinette_table')).toBeInstanceOf(THREE.Mesh);
  });

  it('finds nodes nested at any depth', () => {
    const root = new THREE.Group();
    const mid = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    leaf.name = 'dinette_table';
    mid.add(leaf);
    root.add(mid);
    const subset = PLACEMENTS.filter((p) => p.id === 'dinette_table');
    expect(bindPlacements(root, subset).get('dinette_table')).toBe(leaf);
  });

  it('throws naming the missing node, so a Blender rename fails loudly', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    const incomplete = treeWith(subset.slice(1).map((p) => p.id));
    expect(() => bindPlacements(incomplete, subset)).toThrow(BindingError);
    expect(() => bindPlacements(incomplete, subset)).toThrow(/dinette_chair_fwd/);
  });

  it('lists every missing node in one error, not just the first', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    try {
      bindPlacements(treeWith([]), subset);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('dinette_table');
      expect((err as Error).message).toContain('dinette_chair_aft');
    }
  });
});

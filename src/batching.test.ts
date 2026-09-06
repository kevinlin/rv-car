import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { batchByRole } from './batching';
import { applyFinishes } from './finishes';
import { DEFAULT_REGISTRY } from './data/finishes';

const mesh = (role = 'wood.cabinet') => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.setAttribute('uv1', geometry.getAttribute('uv').clone());
  const material = new THREE.MeshStandardMaterial({ aoMap: new THREE.Texture() });
  material.name = `role.${role}`;
  material.aoMap!.channel = 1;
  return new THREE.Mesh(geometry, material);
};

describe('role batching', () => {
  it('merges exported primitives with mixed unused tangents without losing AO UVs', () => {
    const root = new THREE.Group(), a = mesh('panel.wall'), b = mesh('panel.wall');
    a.geometry.computeTangents();
    root.add(a, b);
    expect(batchByRole(root)).toBe(1);
    const batch = root.getObjectByName('batch.panel.wall') as THREE.Mesh;
    expect(batch.geometry.getAttribute('tangent')).toBeUndefined();
    expect(batch.geometry.getAttribute('uv1').count).toBe(48);
  });

  it('preserves world bounds and original anchors while sharing a role and AO UVs', () => {
    const root = new THREE.Group();
    root.position.set(3, 1, 2);
    root.rotation.y = 0.4;
    const module = new THREE.Group();
    module.scale.z = -1;
    const a = mesh(), b = mesh();
    a.name = 'wardrobe';
    a.position.set(2, 0, 1);
    b.position.set(-1, 2, 3);
    module.add(a, b);
    root.add(module);
    const before = new THREE.Box3().setFromObject(root, true);
    const atlas = a.material.aoMap;
    expect(batchByRole(root)).toBe(1);
    expect(root.getObjectByName('wardrobe')).toBe(a);
    const after = new THREE.Box3().setFromObject(root, true);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6);
    const batch = root.getObjectByName('batch.wood.cabinet') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(batch.material.aoMap).toBe(atlas);
    expect(batch.material.aoMap!.channel).toBe(1);
    expect(batch.geometry.getAttribute('uv1').count).toBe(48);
  });

  it('keeps movable mesh roots independent and both wood roles finishable', () => {
    const root = new THREE.Group();
    const chair = mesh(), detail = mesh('wood.trim'), cabinet = mesh();
    chair.name = 'dinette_chair_fwd';
    chair.position.set(0.3, 0.5, 1.4);
    chair.rotation.y = 0.7;
    detail.position.set(0, 1, 0);
    chair.add(detail);
    root.add(chair, cabinet);
    const before = new THREE.Box3().setFromObject(chair, true);
    expect(batchByRole(root)).toBe(3);
    expect(chair.children.filter((child) => child.name.startsWith('batch.'))).toHaveLength(2);
    const after = new THREE.Box3().setFromObject(chair, true);
    expect(before.min.distanceTo(after.min)).toBeLessThan(1e-6);
    expect(before.max.distanceTo(after.max)).toBeLessThan(1e-6);
    chair.position.x += 1;
    const moved = new THREE.Box3().setFromObject(chair, true);
    expect(moved.min.x - after.min.x).toBeCloseTo(1);
    const registry = structuredClone(DEFAULT_REGISTRY);
    registry['wood.cabinet'].active = 'oak';
    registry['wood.trim'].active = 'oak';
    applyFinishes(root, registry);
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.name.startsWith('batch.')) expect(node.material.color.getHex()).toBe(0xa97f4f);
    });
  });

  it('reverses triangle winding and tangent handedness when baking a reflection', () => {
    const root = new THREE.Group(), reflected = mesh();
    reflected.material.normalMap = new THREE.Texture();
    reflected.geometry.computeTangents();
    reflected.scale.x = -1;
    root.add(reflected);
    batchByRole(root);
    const batch = root.getObjectByName('batch.wood.cabinet') as THREE.Mesh;
    const { geometry } = batch, index = geometry.index!, positions = geometry.getAttribute('position');
    const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(0));
    const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(2));
    const faceNormal = b.sub(a).cross(c.sub(a)).normalize();
    const vertexNormal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), index.getX(0));
    expect(faceNormal.dot(vertexNormal)).toBeCloseTo(1);
    expect(geometry.getAttribute('tangent').getW(0)).toBe(-1);
  });
});

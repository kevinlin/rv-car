import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildGreybox } from './greybox';
import { PLACEMENTS } from './data/vehicle';

describe('buildGreybox', () => {
  it('creates one mesh per placement, named by id', () => {
    const g = buildGreybox();
    expect(g.children.length).toBe(PLACEMENTS.length);
    expect(g.getObjectByName('alcove_bed')).toBeInstanceOf(THREE.Mesh);
    expect(g.getObjectByName('washroom_pod')).toBeInstanceOf(THREE.Mesh);
  });

  it('positions each mesh at the centre of its box, in metres', () => {
    const bed = buildGreybox().getObjectByName('alcove_bed')!;
    // origin x -1100 mm, size 2200 mm -> centre 0 m
    expect(bed.position.x).toBeCloseTo(0);
    // origin z -1400 mm, size 1400 mm -> centre -700 mm -> -0.7 m
    expect(bed.position.z).toBeCloseTo(-0.7);
  });

  it('scales each mesh to the placement size, in metres', () => {
    const bed = buildGreybox().getObjectByName('alcove_bed') as THREE.Mesh;
    bed.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(bed).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2.2);
    expect(size.z).toBeCloseTo(1.4);
  });

  it('renders shell pieces translucent so the interior stays visible', () => {
    const floor = buildGreybox().getObjectByName('floor') as THREE.Mesh;
    const mat = floor.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
  });
});

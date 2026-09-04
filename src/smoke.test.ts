import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('toolchain', () => {
  it('can construct a Three.js vector', () => {
    const v = new THREE.Vector3(1, 2, 3);
    expect(v.length()).toBeCloseTo(Math.sqrt(14));
  });
});

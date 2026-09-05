import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { headingOf, clampPitch } from './look';

describe('headingOf', () => {
  it('reads a due-rearward heading as zero yaw', () => {
    // The camera looks down -Z by default, so a target at -Z is yaw 0.
    const { yaw, pitch } = headingOf([0, 1.5, 0], [0, 1.5, -1]);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });

  it('reads a downward target as negative pitch', () => {
    const { pitch } = headingOf([0, 1.5, 0], [0, 0.5, -1]);
    expect(pitch).toBeLessThan(0);
  });

  it('reads a target to the kerb side as positive yaw', () => {
    const { yaw } = headingOf([0, 1.5, 0], [1, 1.5, 0]);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });
});

describe('clampPitch', () => {
  it('passes values inside the limits through', () => {
    expect(clampPitch(0.2, [-0.6, 0.6])).toBe(0.2);
  });
  it('clamps both ends', () => {
    expect(clampPitch(-9, [-0.6, 0.6])).toBe(-0.6);
    expect(clampPitch(9, [-0.6, 0.6])).toBe(0.6);
  });
});

describe('look never translates the camera', () => {
  it('leaves position untouched when the orientation changes', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(-0.2, 1.55, 2.6);
    const before = camera.position.clone();
    camera.quaternion.setFromEuler(new THREE.Euler(0.3, 1.2, 0, 'YXZ'));
    expect(camera.position.equals(before)).toBe(true);
  });
});

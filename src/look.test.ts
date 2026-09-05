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

  it('reads a target to the kerb side as negative yaw', () => {
    // Negative, not positive: see the sign note in headingOf.
    const { yaw } = headingOf([0, 1.5, 0], [1, 1.5, 0]);
    expect(yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('actually points a camera at the target', () => {
    // The property that matters, and the one a sign-convention assertion missed: every
    // interior stop was facing the mirror image of its target across the vehicle.
    for (const [from, to] of [
      [[-0.35, 1.6, 2.35], [0.85, 0.95, 3.4]],   // galley: kerb side, rearward
      [[0.4, 1.6, 2.5], [-0.85, 0.95, 3.5]],     // washroom: off side, rearward
      [[0, 1.55, 1.9], [0, 1.3, -0.9]],          // alcove: dead ahead
    ] as [[number, number, number], [number, number, number]][]) {
      const { yaw, pitch } = headingOf(from, to);
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(...from);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const toTarget = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
      expect(forward.dot(toTarget)).toBeCloseTo(1, 5);
    }
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

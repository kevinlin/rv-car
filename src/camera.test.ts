import { describe, it, expect } from 'vitest';
import { HOTSPOTS } from './data/vehicle';
import { clamp, easeInOutCubic } from './camera';

describe('clamp', () => {
  it('passes values inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps below and above', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('easeInOutCubic', () => {
  it('is pinned at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('passes through the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('is monotonic', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('HOTSPOTS', () => {
  it('covers every zone a viewer can visit', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    for (const z of ['alcove', 'dinette', 'sofa', 'galley', 'washroom']) {
      expect(ids).toContain(z);
    }
  });

  it('has unique ids', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders every limit range low-to-high', () => {
    for (const h of HOTSPOTS) {
      expect(h.orbit.azimuth[0]).toBeLessThan(h.orbit.azimuth[1]);
      expect(h.orbit.polar[0]).toBeLessThan(h.orbit.polar[1]);
      expect(h.orbit.distance[0]).toBeLessThan(h.orbit.distance[1]);
    }
  });

  it('keeps polar angles inside the legal 0..PI range', () => {
    for (const h of HOTSPOTS) {
      expect(h.orbit.polar[0]).toBeGreaterThanOrEqual(0);
      expect(h.orbit.polar[1]).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('places every camera inside the vehicle, roughly at eye height', () => {
    for (const h of HOTSPOTS) {
      const [x, y, z] = h.camera.position;
      expect(Math.abs(x!)).toBeLessThan(2.0);
      expect(y!).toBeGreaterThan(0.3);
      expect(y!).toBeLessThan(2.0);
      expect(z!).toBeGreaterThan(-2.0);
      expect(z!).toBeLessThan(4.2);
    }
  });
});

describe('clamp with a degenerate duration', () => {
  it('never yields NaN, which would put the camera at an unrenderable position', () => {
    // tweenTo(bundle, h, 0) computes elapsed/ms; on the first frame that is 0/0.
    expect(Number.isNaN(clamp(0 / 0, 0, 1))).toBe(false);
  });
});

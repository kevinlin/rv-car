import { describe, it, expect } from 'vitest';
import { saturation, PATCHES } from './calibrate';

describe('saturation', () => {
  it('reports zero for a perfect neutral', () => {
    expect(saturation(128, 128, 128)).toBe(0);
  });
  it('reports the measured cast of the pre-calibration render', () => {
    // #8c847a, the floor as it rendered before this task.
    expect(saturation(0x8c, 0x84, 0x7a)).toBeCloseTo(0.129, 3);
  });
  it('reports the photographic reference as near-neutral', () => {
    expect(saturation(0x8f, 0x90, 0x94)).toBeLessThan(0.05);
  });
});

describe('PATCHES', () => {
  it('samples every neutral surface named in the spec', () => {
    expect(PATCHES.map((p) => p.role).sort())
      .toEqual(['floor', 'upholstery.seat', 'washroom.shell']);
  });
  it('places every patch inside the viewport', () => {
    for (const p of PATCHES) {
      expect(p.u).toBeGreaterThan(0);
      expect(p.u).toBeLessThan(1);
      expect(p.v).toBeGreaterThan(0);
      expect(p.v).toBeLessThan(1);
    }
  });
});

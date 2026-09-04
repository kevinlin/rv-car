import { describe, it, expect } from 'vitest';
import { coveLightSpecs } from './lighting';

describe('coveLightSpecs', () => {
  it('places one cove light run down each side of the cabin', () => {
    const specs = coveLightSpecs();
    expect(specs.filter((s) => s.position[0] < 0).length).toBeGreaterThan(0);
    expect(specs.filter((s) => s.position[0] > 0).length).toBeGreaterThan(0);
  });

  it('keeps the count low enough for the mobile budget', () => {
    // RectAreaLights are expensive and cast no shadows; the probe does the heavy lifting.
    expect(coveLightSpecs().length).toBeLessThanOrEqual(6);
  });

  it('mounts every cove light near the ceiling', () => {
    for (const s of coveLightSpecs()) {
      expect(s.position[1]).toBeGreaterThan(1.6);
    }
  });

  it('aims every cove light inward and downward', () => {
    for (const s of coveLightSpecs()) {
      expect(s.lookAt[1]).toBeLessThan(s.position[1]);
    }
  });
});

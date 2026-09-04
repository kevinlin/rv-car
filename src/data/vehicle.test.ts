import { describe, it, expect } from 'vitest';
import { ENVELOPE, VOLUMES, ZONE_VOLUME } from './vehicle';

describe('envelope', () => {
  it('holds the published vehicle dimensions exactly', () => {
    expect(ENVELOPE.overallLength!.v).toBe(5998);
    expect(ENVELOPE.overallWidth!.v).toBe(2450);
    expect(ENVELOPE.overallHeight!.v).toBe(3200);
    expect(ENVELOPE.wheelbase!.v).toBe(3300);
  });

  it('tags every published dimension as published', () => {
    for (const key of ['overallLength', 'overallWidth', 'overallHeight', 'wheelbase']) {
      expect(ENVELOPE[key]!.c).toBe('published');
    }
  });

  it('derives the rear axle position from the wheelbase', () => {
    expect(ENVELOPE.rearAxleFromNose!.v).toBe(
      ENVELOPE.frontAxleFromNose!.v + ENVELOPE.wheelbase!.v,
    );
    expect(ENVELOPE.rearAxleFromNose!.c).toBe('derived');
  });

  it('derives habitation length from overall length minus cab depth', () => {
    expect(ENVELOPE.habLength!.v).toBe(
      ENVELOPE.overallLength!.v - ENVELOPE.cabDepth!.v,
    );
  });

  it('derives habitation width from overall width minus two wall thicknesses', () => {
    expect(ENVELOPE.habWidth!.v).toBe(
      ENVELOPE.overallWidth!.v - 2 * ENVELOPE.wallThickness!.v,
    );
  });
});

describe('volumes', () => {
  it('centres the habitation volume on the vehicle centreline', () => {
    const { min, max } = VOLUMES.habitation;
    expect(min[0]).toBe(-max[0]!);
    expect(max[0]! - min[0]!).toBe(ENVELOPE.habWidth!.v);
  });

  it('starts the habitation volume at the bulkhead and floor', () => {
    expect(VOLUMES.habitation.min[1]).toBe(0);
    expect(VOLUMES.habitation.min[2]).toBe(0);
  });

  it('extends the slide-out volume outboard of the habitation box', () => {
    expect(VOLUMES.slideout.min[0]!).toBeLessThan(VOLUMES.habitation.min[0]!);
  });

  it('places the alcove volume forward of the bulkhead and above the floor', () => {
    expect(VOLUMES.alcove.min[2]!).toBeLessThan(0);
    expect(VOLUMES.alcove.min[1]!).toBeGreaterThan(0);
  });

  it('gives every non-shell zone a volume', () => {
    const zones = ['cab', 'alcove', 'dinette', 'sofa', 'storage', 'galley', 'washroom'] as const;
    for (const z of zones) {
      expect(VOLUMES[ZONE_VOLUME[z]]).toBeDefined();
    }
  });
});

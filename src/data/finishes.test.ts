import { describe, it, expect } from 'vitest';
import { DEFAULT_REGISTRY, type Role } from './finishes';

/** HSV saturation of a packed 0xRRGGBB colour. 0 is a perfect neutral. */
const saturation = (hex: number): number => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/**
 * Surfaces the reference photography shows as neutral. Measured off the brochure shots:
 * seat leather 0.015, floor vinyl 0.034, washroom shell effectively 0. The threshold sits
 * above all three and below the values these roles carried before this task.
 */
const NEUTRAL_ROLES: Role[] = ['floor', 'upholstery.seat', 'washroom.shell'];
const MAX_NEUTRAL_SATURATION = 0.05;

describe('neutral roles', () => {
  it('keeps every variant of every neutral role under the threshold', () => {
    for (const role of NEUTRAL_ROLES) {
      for (const v of DEFAULT_REGISTRY[role].variants) {
        expect(saturation(v.params.color), `${role}/${v.id}`).toBeLessThan(
          MAX_NEUTRAL_SATURATION,
        );
      }
    }
  });

  it('leaves deliberately warm roles alone', () => {
    // panel.wall is a warm cream in the photographs and must NOT be neutralised.
    expect(saturation(DEFAULT_REGISTRY['panel.wall'].variants[0]!.params.color))
      .toBeGreaterThan(MAX_NEUTRAL_SATURATION);
  });
});

describe('the livery decal', () => {
  it('lands exactly one copy on the 3.4 x 0.70 m panel', () => {
    // The UV spans 3.4 x 0.70 because box_uv writes it that way, matching the 1.0 UV/m the rest
    // of the pipeline holds every unwrap to. A repeat of 1 would tile the wordmark four times
    // across the flank.
    const map = DEFAULT_REGISTRY['body.graphic'].variants[0]!.params.map!;
    expect(map.repeat![0]! * 3.4).toBeCloseTo(1, 6);
    expect(map.repeat![1]! * 0.70).toBeCloseTo(1, 6);
  });
});

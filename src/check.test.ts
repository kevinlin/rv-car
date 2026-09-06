import { describe, it, expect } from 'vitest';
import { boxesOverlap, boxContains, minAisleWidth, checkAll, MIN_AISLE_MM } from './check';
import { PLACEMENTS, aabb, type Placement } from './data/vehicle';

const box = (
  min: [number, number, number],
  max: [number, number, number],
) => ({ min, max });

describe('boxesOverlap', () => {
  it('detects overlap in all three axes', () => {
    expect(boxesOverlap(box([0, 0, 0], [10, 10, 10]), box([5, 5, 5], [15, 15, 15]))).toBe(true);
  });

  it('treats touching faces as not overlapping', () => {
    expect(boxesOverlap(box([0, 0, 0], [10, 10, 10]), box([10, 0, 0], [20, 10, 10]))).toBe(false);
  });

  it('returns false when separated on a single axis', () => {
    // Overhead locker directly above a chair: same X and Z, different Y.
    expect(boxesOverlap(box([0, 0, 0], [10, 5, 10]), box([0, 8, 0], [10, 12, 10]))).toBe(false);
  });
});

describe('boxContains', () => {
  it('accepts an inner box fully inside', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([1, 1, 1], [9, 9, 9]))).toBe(true);
  });

  it('accepts an inner box flush with the outer face', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([0, 0, 0], [10, 10, 10]))).toBe(true);
  });

  it('rejects an inner box poking out', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([1, 1, 1], [11, 9, 9]))).toBe(false);
  });
});

describe('minAisleWidth', () => {
  it('measures the narrowest gap between off-side and kerb-side furniture', () => {
    expect(minAisleWidth(PLACEMENTS)).toBeGreaterThanOrEqual(MIN_AISLE_MM);
  });

  it('reports 560 mm for the deployed layout', () => {
    // Lounge seat pair's inboard edge at -110, slide-out bed's inboard edge at +450.
    expect(minAisleWidth(PLACEMENTS)).toBe(560);
  });
});

describe('handedness', () => {
  // This cabin has been flipped four times, each pass reading a flank off a still photograph
  // and getting it wrong. The manufacturer's walkthrough video settles both halves, and they
  // do not point the same way — which is the trap every previous pass fell into, because each
  // assumed one chain of inference ran the length of the vehicle.
  //
  // From the lounge looking aft through the partition (8:32-8:56, hi-res), the sofa bench is
  // on the left and the booth's pair of seats on the right; looking aft, left is kerb. In the
  // same frames, through the doorway, the galley's pegboard and counter are on the left and
  // the mirrored washroom door on the right. The 3:50 frame through the open rear door, where
  // the sense reverses, agrees on the service room.
  //
  // So the lounge and the service room are handed opposite ways: the galley sits behind the
  // wardrobe rather than continuing the fridge's line. Pinned so a fifth flip fails loudly.
  // Evidence in docs/research/walkthrough/.
  const box = (id: string) => aabb(PLACEMENTS.find((p) => p.id === id)!);

  it('keeps the galley on the kerb flank and the washroom pod on the off flank', () => {
    expect(box('galley_run').min[0]).toBeGreaterThanOrEqual(0);
    expect(box('galley_overhead').min[0]).toBeGreaterThanOrEqual(0);
    expect(box('washroom_pod').max[0]).toBeLessThanOrEqual(0);
  });

  it('keeps the booth off and the slide-out kerb, facing each other across the aisle', () => {
    // The fridge stands beside a booth seat, so it shares the booth's flank rather than the
    // galley's — the link the whole-cabin mirror got wrong.
    expect(box('fridge').max[0]).toBeLessThanOrEqual(0);
    for (const id of ['dinette_chair_fwd', 'dinette_chair_aft_off', 'dinette_chair_aft_kerb']) {
      expect(box(id).max[0]).toBeLessThanOrEqual(0);
    }
    expect(box('slideout_bed').min[0]).toBeGreaterThanOrEqual(0);
  });

  it('puts the galley opposite the wardrobe, not behind the fridge', () => {
    // The one assertion that distinguishes this layout from both of the ones it replaced.
    expect(box('wardrobe').min[0]).toBeGreaterThanOrEqual(0);
    expect(box('galley_run').min[0]).toBeGreaterThanOrEqual(0);
    expect(box('fridge').max[0]).toBeLessThanOrEqual(0);
    expect(box('washroom_pod').max[0]).toBeLessThanOrEqual(0);
  });
});

describe('checkAll', () => {
  it('passes on the shipped placement data', () => {
    expect(checkAll()).toEqual([]);
  });

  it('reports an overlap when two pieces are pushed into each other', () => {
    const broken: Placement[] = PLACEMENTS.map((p) =>
      // Aft, into the seat pair it sits in front of. Sliding it sideways no longer collides
      // with anything: the booth is a fore-aft sandwich of seats, table, seats.
      p.id === 'dinette_table'
        ? { ...p, origin: [p.origin[0], p.origin[1], { v: 1400, c: 'estimated' as const }] as const }
        : p,
    );
    expect(checkAll(broken).some((v) => v.rule === 'overlap')).toBe(true);
  });

  it('reports containment failure when a piece leaves its volume', () => {
    const broken: Placement[] = PLACEMENTS.map((p) =>
      p.id === 'washroom_pod'
        ? { ...p, origin: [{ v: -3000, c: 'estimated' as const }, p.origin[1], p.origin[2]] as const }
        : p,
    );
    expect(checkAll(broken).some((v) => v.rule === 'containment')).toBe(true);
  });

  it('reports an aisle violation when the bed is widened into the walkway', () => {
    // The bed grows inboard from its outboard edge at X 1730, so the extra 520 mm comes out
    // of the aisle rather than out of the slide-out box.
    const broken: Placement[] = PLACEMENTS.map((p) =>
      p.id === 'slideout_bed'
        ? {
            ...p,
            origin: [{ v: -70, c: 'estimated' as const }, p.origin[1], p.origin[2]] as const,
            size: [{ v: 1800, c: 'estimated' as const }, p.size[1], p.size[2]] as const,
          }
        : p,
    );
    expect(checkAll(broken).some((v) => v.rule === 'aisle')).toBe(true);
  });

  it('reports a published violation when a bed size is changed', () => {
    const broken: Placement[] = PLACEMENTS.map((p) =>
      p.id === 'alcove_bed'
        ? { ...p, size: [{ v: 2000, c: 'estimated' as const }, p.size[1], p.size[2]] as const }
        : p,
    );
    expect(checkAll(broken).some((v) => v.rule === 'published')).toBe(true);
  });
});

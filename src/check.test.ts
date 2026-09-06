import { describe, it, expect } from 'vitest';
import { boxesOverlap, boxContains, minAisleWidth, checkAll, MIN_AISLE_MM } from './check';
import { PLACEMENTS, type Placement } from './data/vehicle';

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
    // Lounge seat pair's inboard edge at -110, slide-out bed inboard edge at +450.
    expect(minAisleWidth(PLACEMENTS)).toBe(560);
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

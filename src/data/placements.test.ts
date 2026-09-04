import { describe, it, expect } from 'vitest';
import { PLACEMENTS, aabb, type Placement } from './vehicle';

const byId = (id: string): Placement => {
  const p = PLACEMENTS.find((x) => x.id === id);
  if (!p) throw new Error(`no placement "${id}"`);
  return p;
};

describe('placements', () => {
  it('has unique ids', () => {
    const ids = PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only positive sizes', () => {
    for (const p of PLACEMENTS) {
      for (const s of p.size) expect(s.v).toBeGreaterThan(0);
    }
  });

  it('honours the published alcove bed size exactly', () => {
    const bed = byId('alcove_bed');
    expect(bed.size[0].v).toBe(2200); // across the vehicle
    expect(bed.size[2].v).toBe(1400); // fore-aft
    expect(bed.size[0].c).toBe('published');
    expect(bed.size[2].c).toBe('published');
  });

  it('honours the published slide-out bed size exactly', () => {
    const bed = byId('slideout_bed');
    expect(bed.size[0].v).toBe(1280); // outboard
    expect(bed.size[2].v).toBe(1900); // fore-aft
    expect(bed.size[0].c).toBe('published');
    expect(bed.size[2].c).toBe('published');
  });

  it('computes an axis-aligned box from origin plus size', () => {
    const box = aabb(byId('alcove_bed'));
    expect(box.min[0]).toBe(-1100);
    expect(box.max[0]).toBe(1100);
    expect(box.max[2] - box.min[2]).toBe(1400);
  });

  it('marks the dinette chairs and table movable, and nothing structural', () => {
    expect(byId('dinette_chair_fwd_in').movable).toBe(true);
    expect(byId('dinette_table').movable).toBe(true);
    expect(byId('washroom_pod').movable).toBe(false);
    expect(byId('floor').movable).toBe(false);
  });

  it('has at least one placement in every zone', () => {
    const zones = ['shell', 'cab', 'alcove', 'dinette', 'sofa', 'storage', 'galley', 'washroom'];
    for (const z of zones) {
      expect(PLACEMENTS.some((p) => p.zone === z)).toBe(true);
    }
  });
});

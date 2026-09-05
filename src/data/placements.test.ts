import { describe, it, expect } from 'vitest';
import { ENVELOPE, PLACEMENTS, aabb, type Placement } from './vehicle';

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

describe('exterior', () => {
  const exterior = PLACEMENTS.filter((p) => p.zone === 'exterior');

  it('models the body, the slide-out box, four wheels and the skirt', () => {
    expect(exterior.map((p) => p.id).sort()).toEqual([
      'body_alcove', 'body_cab', 'body_habitation', 'skirt', 'slideout_box',
      'wheel_front_kerb', 'wheel_front_off', 'wheel_rear_kerb', 'wheel_rear_off',
    ]);
  });

  it('reproduces the published envelope exactly', () => {
    // The slide-out is deployed, and 2450 mm is the RETRACTED width, so it is excluded here.
    const body = exterior.filter((p) => p.id !== 'slideout_box').map(aabb);
    const min = (i: number) => Math.min(...body.map((b) => b.min[i]!));
    const max = (i: number) => Math.max(...body.map((b) => b.max[i]!));

    expect(max(0) - min(0)).toBe(ENVELOPE.overallWidth!.v);   // 2450
    expect(max(2) - min(2)).toBe(ENVELOPE.overallLength!.v);  // 5998
    // Height is measured from the ground, which sits floorAboveGround below the origin.
    expect(max(1) + ENVELOPE.floorAboveGround!.v).toBe(ENVELOPE.overallHeight!.v); // 3200
  });

  it('puts the wheels on the published axle lines', () => {
    const centre = (id: string) => {
      const b = aabb(PLACEMENTS.find((p) => p.id === id)!);
      return (b.min[2]! + b.max[2]!) / 2;
    };
    const front = -ENVELOPE.cabDepth!.v + ENVELOPE.frontAxleFromNose!.v;
    expect(centre('wheel_front_off')).toBe(front);
    expect(centre('wheel_rear_off')).toBe(front + ENVELOPE.wheelbase!.v);
  });
});

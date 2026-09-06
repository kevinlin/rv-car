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
    expect(byId('dinette_chair_fwd').movable).toBe(true);
    expect(byId('dinette_table').movable).toBe(true);
    expect(byId('washroom_pod').movable).toBe(false);
    expect(byId('floor').movable).toBe(false);
  });

  it('seats three in the lounge, which is what the published occupancy leaves', () => {
    // S4 gives the layout as 中部3人汽车座椅, and 5 seated minus the cab's two agrees.
    // Four lounge chairs would need six belts in a vehicle sold as a five-seater.
    const lounge = PLACEMENTS.filter((p) => p.id.startsWith('dinette_chair_'));
    const cab = PLACEMENTS.filter((p) => p.id.startsWith('cab_seat_'));
    expect(lounge).toHaveLength(3);
    expect(lounge.length + cab.length).toBe(5);
  });

  it('faces the lounge seats off across the table, one forward and two aft', () => {
    // 对面摆, 前一后二: a booth, not a row. The seats sandwich the table fore-aft.
    const seats = PLACEMENTS.filter((p) => p.id.startsWith('dinette_chair_')).map(aabb);
    const table = aabb(byId('dinette_table'));
    const fwd = seats.filter((s) => s.max[2] <= table.min[2]);
    const aft = seats.filter((s) => s.min[2] >= table.max[2]);
    expect(fwd).toHaveLength(1);
    expect(aft).toHaveLength(2);
    // The pair sits abreast: one Z between them, two X positions, and no gap to fall down.
    expect(new Set(aft.map((s) => s.min[2])).size).toBe(1);
    expect(new Set(aft.map((s) => s.min[0])).size).toBe(2);
    expect(Math.max(...aft.map((s) => s.min[0]))).toBe(Math.min(...aft.map((s) => s.max[0])));
    // The table is reachable from both sides, not parked outboard of the seats.
    expect(table.min[0]).toBeGreaterThanOrEqual(Math.min(...seats.map((s) => s.min[0])));
    expect(table.max[0]).toBeLessThanOrEqual(Math.max(...seats.map((s) => s.max[0])));
  });

  it('divides the rear service room off with a full-width partition', () => {
    // 尾部独立厨卫区: the rear kitchen and washroom are only independent if something closes.
    const box = aabb(byId('partition'));
    expect(box.min[0]).toBe(-ENVELOPE.habWidth!.v / 2);
    expect(box.max[0]).toBe(ENVELOPE.habWidth!.v / 2);
    expect(box.max[1]).toBe(ENVELOPE.habHeight!.v); // floor to ceiling, not a half-height unit
    // Aft of everything in the lounge, forward of everything in the service room.
    const maxZ = (zone: string) =>
      Math.max(...PLACEMENTS.filter((p) => p.zone === zone).map((p) => aabb(p).max[2]!));
    const minZ = (zone: string) =>
      Math.min(...PLACEMENTS.filter((p) => p.zone === zone).map((p) => aabb(p).min[2]!));
    expect(box.min[2]).toBeGreaterThanOrEqual(maxZ('dinette'));
    expect(box.max[2]).toBeLessThanOrEqual(Math.min(minZ('galley'), minZ('washroom')));
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

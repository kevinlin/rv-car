import { describe, it, expect } from 'vitest';
import { boxesOverlap, boxContains, minAisleWidth, checkAll, MIN_AISLE_MM } from './check';
import { VOLUMES, PLACEMENTS, aabb, type Placement } from './data/vehicle';

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
  // and getting it wrong. The manufacturer's walkthrough video settles the lounge, and the
  // updated spatial brief settles the service room; they do not point the same way, which is
  // the trap every previous pass fell into by assuming one chain of inference ran the length
  // of the vehicle.
  //
  // Lounge: from the lounge looking aft through the partition (8:32-8:56, hi-res), the sofa
  // bench is on the left and the booth's pair of seats on the right; looking aft, left is kerb.
  //
  // Service room: the boarding door is in the KERB flank forward of the rear corner, not in the
  // rear wall — the 2:38 and 3:23 walkaround frames open it there, with the grab rail, keypad
  // and vent on the flank aft of it. The room is arranged about the path leading in from that
  // door: worktop and basin on your left as you enter, which is the run backing onto the rear
  // wall; the 3-in-1 oven shelf on your right, against the kerb flank forward of the door; the
  // washroom pod ahead, on the off flank against the partition.
  //
  // Evidence in docs/research/walkthrough/ and docs/research/spatial-brief_*.md.
  const box = (id: string) => aabb(PLACEMENTS.find((p) => p.id === id)!);

  it('keeps the booth off and the slide-out kerb, facing each other across the aisle', () => {
    for (const id of ['dinette_chair_fwd', 'dinette_chair_aft_off', 'dinette_chair_aft_kerb']) {
      expect(box(id).max[0]).toBeLessThanOrEqual(0);
    }
    expect(box('slideout_bed').min[0]).toBeGreaterThanOrEqual(0);
  });

  it('puts the boarding door in the kerb flank, clear of the rear corner', () => {
    const door = box('entry_door');
    const rear = box('wall_rear');
    expect(door.min[0]).toBeGreaterThan(0);
    expect(door.max[2]).toBeLessThan(rear.min[2]!);
    // The walkaround needs that stretch of flank aft of the door for the grab rail, the keypad
    // and the vent. Without a floor under it the door drifts back into the corner.
    expect(rear.min[2]! - door.max[2]!).toBeGreaterThanOrEqual(300);
  });

  it('backs the worktop onto the rear wall, on your left as you enter', () => {
    // Left as you enter a kerb door is AFT, so the run crosses the centreline against the rear
    // wall rather than hugging a flank. This is the assertion that distinguishes this layout
    // from the two flank-run layouts it replaced.
    const run = box('galley_run');
    const rear = box('wall_rear');
    expect(run.max[2]).toBe(rear.min[2]);
    expect(run.min[0]).toBeLessThan(0);
    expect(run.max[0]).toBeGreaterThan(0);
    expect(box('galley_overhead').min[2]).toBe(run.min[2]);
  });

  it('puts the oven shelf on the kerb flank, forward of the door', () => {
    const oven = box('galley_oven');
    expect(oven.max[0]).toBe(VOLUMES.habitation.max[0]);
    expect(oven.max[2]).toBeLessThanOrEqual(box('entry_door').min[2]!);
    // Clear of the partition doorway, which is 760 mm on the centreline.
    expect(oven.min[0]).toBeGreaterThanOrEqual(380);
  });

  it('stands the pod on the off flank against the partition, and the fridge beside the run', () => {
    const pod = box('washroom_pod');
    expect(pod.max[0]).toBeLessThanOrEqual(0);
    expect(pod.min[2]).toBeGreaterThanOrEqual(box('partition').max[2]!);
    const fridge = box('fridge');
    expect(fridge.max[0]).toBeLessThanOrEqual(0);
    expect(fridge.min[2]).toBe(box('galley_run').min[2]);
    expect(fridge.max[0]).toBe(box('galley_run').min[0]);
  });

  it('leaves a walkable path in from the door and on to the partition doorway', () => {
    // Straight in from the door, between the oven shelf and the worktop.
    expect(box('galley_run').min[2]! - box('galley_oven').max[2]!).toBeGreaterThanOrEqual(400);
    // And on forward, between the pod and the shelf, to the doorway.
    expect(box('galley_oven').min[0]! - box('washroom_pod').max[0]!).toBeGreaterThanOrEqual(400);
  });
});

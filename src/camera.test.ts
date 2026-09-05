import { describe, it, expect } from 'vitest';
import { HOTSPOTS, PLACEMENTS, aabb } from './data/vehicle';
import * as THREE from 'three';
import { clamp, easeInOutCubic, tweenTo } from './camera';
import type { SceneBundle } from './scene';

describe('clamp', () => {
  it('passes values inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps below and above', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('easeInOutCubic', () => {
  it('is pinned at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('passes through the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('is monotonic', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('HOTSPOTS', () => {
  it('covers every zone a viewer can visit', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    for (const z of ['alcove', 'dinette', 'sofa', 'galley', 'washroom']) {
      expect(ids).toContain(z);
    }
  });

  it('has unique ids', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders every limit range low-to-high', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind === 'look') {
        expect(h.view.pitch[0]).toBeLessThan(h.view.pitch[1]);
      } else {
        expect(h.view.azimuth[0]).toBeLessThan(h.view.azimuth[1]);
        expect(h.view.polar[0]).toBeLessThan(h.view.polar[1]);
        expect(h.view.distance[0]).toBeLessThan(h.view.distance[1]);
      }
    }
  });

  it('keeps every angle in a legal range', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind === 'look') {
        // Pitch is signed from the horizon; straight up and straight down are the limits.
        expect(h.view.pitch[0]).toBeGreaterThanOrEqual(-Math.PI / 2);
        expect(h.view.pitch[1]).toBeLessThanOrEqual(Math.PI / 2);
      } else {
        expect(h.view.polar[0]).toBeGreaterThanOrEqual(0);
        expect(h.view.polar[1]).toBeLessThanOrEqual(Math.PI);
      }
    }
  });

  it('gives every interior stop free look', () => {
    // The whole point of this change: no interior stop may clamp azimuth, because orbiting
    // a 2.36 m cabin at 1.2 m radius drives the camera through the walls.
    // Cast: ZoneId does not carry 'exterior' until the exterior placements land, and this
    // must keep excluding the exterior stop once it does.
    const interior = HOTSPOTS.filter((h) => (h.id as string) !== 'exterior');
    expect(interior.every((h) => h.view.kind === 'look')).toBe(true);
  });

  it('places every camera inside the vehicle, roughly at eye height', () => {
    for (const h of HOTSPOTS) {
      const [x, y, z] = h.camera.position;
      expect(Math.abs(x!)).toBeLessThan(2.0);
      expect(y!).toBeGreaterThan(0.3);
      expect(y!).toBeLessThan(2.0);
      expect(z!).toBeGreaterThan(-2.0);
      expect(z!).toBeLessThan(4.2);
    }
  });
});

describe('clamp with a degenerate duration', () => {
  it('never yields NaN, which would put the camera at an unrenderable position', () => {
    // tweenTo(bundle, h, 0) computes elapsed/ms; on the first frame that is 0/0.
    expect(Number.isNaN(clamp(0 / 0, 0, 1))).toBe(false);
  });
});

describe('hotspot cameras stand in free space', () => {
  // Two of the grey-box positions ended up inside geometry that was modelled later — the cab
  // camera in the alcove mattress, the washroom camera in the storage band's header.
  it('puts no camera inside a placement', () => {
    const inside = HOTSPOTS.filter((h) =>
      PLACEMENTS.filter((p) => p.zone !== 'shell').some((p) => {
        const b = aabb(p);
        return h.camera.position.every(
          (v, i) => v * 1000 >= b.min[i]! - 60 && v * 1000 <= b.max[i]! + 60,
        );
      }),
    );
    expect(inside.map((h) => h.id)).toEqual([]);
  });
});

describe('tweenTo', () => {
  /** Minimal stand-ins: tweenTo only touches the camera and the controls' limits and target. */
  const bundle = () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = {
      target: new THREE.Vector3(),
      enabled: true,
      minAzimuthAngle: 0, maxAzimuthAngle: 0,
      minPolarAngle: 1.2, maxPolarAngle: 1.4,
      minDistance: 2, maxDistance: 2,
      update: () => {},
    };
    const look = {
      enabled: false,
      aim: () => {}, setPitch: () => {}, update: () => {}, dispose: () => {},
    };
    return { camera, controls, look } as unknown as SceneBundle;
  };

  it('releases the previous hotspot polar limits before flying', () => {
    // Without this the previous zone's polar floor drags the arriving camera off its pose.
    globalThis.requestAnimationFrame = () => 0; // vitest runs in node; the flight never ticks
    const b = bundle();
    void tweenTo(b, HOTSPOTS[2]!, 500);
    expect(b.controls.minPolarAngle).toBe(0);
    expect(b.controls.maxPolarAngle).toBe(Math.PI);
  });

  it('snaps to the hotspot pose at zero duration', () => {
    const b = bundle();
    const h = HOTSPOTS[0]!;
    void tweenTo(b, h, 0);
    expect(b.camera.position.toArray()).toEqual([...h.camera.position]);
    expect(b.controls.target.toArray()).toEqual([...h.camera.target]);
  });
});

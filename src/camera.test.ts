import { describe, it, expect } from 'vitest';
import { HOTSPOTS, PLACEMENTS, aabb } from './data/vehicle';
import * as THREE from 'three';
import { applyHotspotLimits, clamp, easeInOutCubic, tweenTo } from './camera';
import { ENCLOSURES } from './check';
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
    // No stop inside the cabin may clamp azimuth: orbiting a 2.36 m cabin at 1.2 m radius
    // drives the camera through the walls. Discriminating on view.kind rather than on
    // id !== 'exterior' is what lets a second outside-the-cabin stop exist.
    const inside = HOTSPOTS.filter((h) => h.view.kind === 'look');
    expect(inside.length).toBeGreaterThanOrEqual(6);
    expect(inside.every((h) => h.view.kind === 'look')).toBe(true);
  });

  it('places every interior camera inside the vehicle, roughly at eye height', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind !== 'look') continue; // outside stops stand where they must
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
      // Same exclusion the dimensional checks use: an enclosure contains every camera
      // by design, so 'inside the body' is not the collision this guards against.
      PLACEMENTS.filter((p) => !ENCLOSURES.has(p.zone)).some((p) => {
        const b = aabb(p);
        return h.camera.position.every(
          (v, i) => v * 1000 >= b.min[i]! - 60 && v * 1000 <= b.max[i]! + 60,
        );
      }),
    );
    expect(inside.map((h) => h.id)).toEqual([]);
  });
});

describe('the partition splits the stops in two', () => {
  // With a real divider across the vehicle, a stop on the wrong side of it looks at a wall or
  // squints through a doorway. The lounge camera used to stand at Z 2.6, aft of where the
  // partition now is; the washroom camera stood exactly in its plane.
  const partition = aabb(PLACEMENTS.find((p) => p.id === 'partition')!);

  it('keeps the lounge stops forward of it and the service stops aft', () => {
    const side = (id: string) => HOTSPOTS.find((h) => h.id === id)!.camera.position[2]! * 1000;
    for (const id of ['dinette', 'sofa', 'alcove', 'cab']) {
      expect(side(id)).toBeLessThan(partition.min[2]!);
    }
    for (const id of ['galley', 'washroom']) {
      expect(side(id)).toBeGreaterThan(partition.max[2]!);
    }
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

describe('the exterior stop', () => {
  const exterior = HOTSPOTS.find((h) => h.id === 'exterior');

  it('exists and orbits', () => {
    expect(exterior?.view.kind).toBe('orbit');
  });

  it('stands outside the body at every point of its orbit', () => {
    // Nearest body face is 1.225 m from the centreline; the ring must clear it.
    if (exterior?.view.kind !== 'orbit') throw new Error('exterior must orbit');
    expect(exterior.view.distance[0]).toBeGreaterThan(1.225);
  });

  it('is left unclamped in azimuth, because a whole turn is not a range', () => {
    if (exterior?.view.kind !== 'orbit') throw new Error('exterior must orbit');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(...(exterior.camera.position as [number, number, number]));
    const controls = {
      minAzimuthAngle: 0, maxAzimuthAngle: 0,
      minPolarAngle: 0, maxPolarAngle: 0,
      minDistance: 0, maxDistance: 0,
      update: () => {},
    } as unknown as Parameters<typeof applyHotspotLimits>[0];
    applyHotspotLimits(controls, camera, exterior.camera.target, exterior.view);
    expect(controls.minAzimuthAngle).toBe(-Infinity);
    expect(controls.maxAzimuthAngle).toBe(Infinity);
  });

  it('never looks up from below the ground plane', () => {
    if (exterior?.view.kind !== 'orbit') throw new Error('exterior must orbit');
    expect(exterior.view.polar[1]).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('starts outside the body and above the ground', () => {
    // The interior test above skips this stop, so its own bound lives here.
    const [x, y, z] = exterior!.camera.position;
    expect(Math.hypot(x!, z!)).toBeGreaterThan(3.5);
    expect(y!).toBeGreaterThan(-1.05); // floorAboveGround: the ground plane
  });
});

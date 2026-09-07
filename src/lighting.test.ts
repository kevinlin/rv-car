import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { coveLightSpecs, installLighting } from './lighting';

describe('coveLightSpecs', () => {
  it('places one cove light run down each side of the cabin', () => {
    const specs = coveLightSpecs();
    expect(specs.filter((s) => s.position[0] < 0).length).toBeGreaterThan(0);
    expect(specs.filter((s) => s.position[0] > 0).length).toBeGreaterThan(0);
  });

  it('keeps the count low enough for the mobile budget', () => {
    // RectAreaLights are expensive and cast no shadows; the probe does the heavy lifting.
    expect(coveLightSpecs().length).toBeLessThanOrEqual(6);
  });

  it('mounts every cove light near the ceiling', () => {
    for (const s of coveLightSpecs()) {
      expect(s.position[1]).toBeGreaterThan(1.6);
    }
  });

  it('aims every cove light inward and downward', () => {
    for (const s of coveLightSpecs()) {
      expect(s.lookAt[1]).toBeLessThan(s.position[1]);
    }
  });
});

describe('refreshProbe and clipping planes', () => {
  it('captures the probe with clipping off, and restores the caller planes', () => {
    // The probe camera sits inside the cabin. A clip plane set for the plan stop would let it
    // see sky through the missing roof, and every interior material's bounce light would
    // change for the rest of the session.
    const scene = new THREE.Scene();
    const vehicle = new THREE.Group();
    scene.add(vehicle);

    const planes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4)];
    const seen: THREE.Plane[][] = [];
    const renderer = {
      clippingPlanes: planes,
      shadowMap: { autoUpdate: true, needsUpdate: false },
      // CubeCamera.update calls renderer.render six times; record what was set each time.
      render: () => { seen.push([...(renderer.clippingPlanes as THREE.Plane[])]); },
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      xr: { enabled: false },
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      // CubeCamera.update reads this on its first call and throws if it is undefined.
      coordinateSystem: THREE.WebGLCoordinateSystem,
    } as unknown as THREE.WebGLRenderer;

    const { refreshProbe } = installLighting(scene, renderer, vehicle, []);
    refreshProbe();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((p) => p.length === 0)).toBe(true);
    expect(renderer.clippingPlanes).toBe(planes);
  });
});

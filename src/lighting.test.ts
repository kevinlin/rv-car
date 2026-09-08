import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
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
  it('isolates all six probe faces and restores the stop state before rebuilding shadows', () => {
    // The probe camera sits inside the cabin. A clip plane set for the plan stop would let it
    // see sky through the missing roof, and every interior material's bounce light would
    // change for the rest of the session.
    const scene = new THREE.Scene();
    const vehicle = new THREE.Group();
    const body = new THREE.Mesh();
    const hiddenTrim = new THREE.Mesh();
    hiddenTrim.visible = false;
    vehicle.add(body, hiddenTrim);
    const sky = new Sky();
    const sun = new THREE.DirectionalLight();
    scene.add(vehicle, sky, sun);
    const interiorBackground = new THREE.Color(0xeef3fb);
    scene.background = interiorBackground;

    const planes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4)];
    const seen: THREE.Plane[][] = [];
    const renderer = {
      clippingPlanes: planes,
      shadowMap: { autoUpdate: true, needsUpdate: false },
      // CubeCamera.update calls renderer.render six times; record what was set each time.
      render: () => {
        seen.push([...(renderer.clippingPlanes as THREE.Plane[])]);
        expect(scene.environment).toBeNull();
        expect(scene.background).toBe(interiorBackground);
        expect([body.visible, hiddenTrim.visible, sky.visible, sun.visible]).toEqual([false, false, false, false]);
        // WebGLShadowMap consumes the flag on the first cube face.
        renderer.shadowMap.needsUpdate = false;
      },
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      xr: { enabled: false },
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      // CubeCamera.update reads this on its first call and throws if it is undefined.
      coordinateSystem: THREE.WebGLCoordinateSystem,
    } as unknown as THREE.WebGLRenderer;

    const { refreshProbe } = installLighting(scene, renderer, vehicle, [body, hiddenTrim], { sky, sun });
    const interiorEnvironment = scene.environment;
    expect(interiorEnvironment).not.toBeNull();
    const skyEnvironment = new THREE.Texture();
    for (const exterior of [true, false]) {
      const environment = exterior ? skyEnvironment : interiorEnvironment;
      const intensity = exterior ? 0.8 : 2.5;
      const background = exterior ? null : interiorBackground;
      scene.environment = environment;
      scene.environmentIntensity = intensity;
      scene.background = background;
      sky.visible = sun.visible = body.visible = exterior;
      renderer.shadowMap.needsUpdate = false;
      refreshProbe();
      expect(scene.environment).toBe(environment);
      expect(scene.environmentIntensity).toBe(intensity);
      expect(scene.background).toBe(background);
      expect([body.visible, hiddenTrim.visible, sky.visible, sun.visible]).toEqual([exterior, false, exterior, exterior]);
      expect(renderer.shadowMap.needsUpdate).toBe(true);
      expect(renderer.shadowMap.autoUpdate).toBe(false);
    }

    expect(seen.length).toBe(18);
    expect(seen.every((p) => p.length === 0)).toBe(true);
    expect(renderer.clippingPlanes).toBe(planes);
  });
});

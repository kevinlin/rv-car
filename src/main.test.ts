// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createScene, type SceneBundle } from './scene';
import { loadModules } from './loader';
import { ALL_ROLES, EXTERIOR_ROLES } from './data/finishes';
import { HOTSPOTS, PLAN_CUT_MM } from './data/vehicle';

vi.mock('./scene', () => ({ createScene: vi.fn() }));
vi.mock('./loader', () => ({ loadModules: vi.fn() }));
vi.mock('./binding', () => ({ bindPlacements: () => new Map() }));
vi.mock('./textures', () => ({ createTextureResolver: () => () => null }));
vi.mock('./camera', async (original) => {
  const camera = await original<typeof import('./camera')>();
  return { ...camera, tweenTo: (bundle: SceneBundle, stop: Parameters<typeof camera.tweenTo>[1]) => camera.tweenTo(bundle, stop, 0) };
});

it('keeps plan lighting indoors, preserves stop state on finish swaps, and invalidates shadows on transitions', async () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef3fb);
  const sky = new Sky();
  const sun = new THREE.DirectionalLight();
  sky.visible = sun.visible = false;
  scene.add(sky, sun);
  const vehicle = new THREE.Group();
  const visibleMeshes = () => {
    const meshes: THREE.Mesh[] = [];
    vehicle.traverseVisible((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
    return meshes;
  };
  let probeFaces = 0;
  const renderer = {
    clippingPlanes: [] as THREE.Plane[],
    shadowMap: { autoUpdate: true, needsUpdate: false },
    render: () => {
      renderer.shadowMap.needsUpdate = false;
      probeFaces++;
      const meshes = visibleMeshes();
      expect(meshes.some((o) => o.name === 'batch.panel.wall')).toBe(true);
      expect(meshes.some((o) => o.material instanceof THREE.Material
        && EXTERIOR_ROLES.some((role) => o.material instanceof THREE.Material && o.material.name === `role.${role}`))).toBe(false);
    },
    setAnimationLoop: () => {},
    getRenderTarget: () => null, setRenderTarget: () => {},
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    xr: { enabled: false }, coordinateSystem: THREE.WebGLCoordinateSystem,
  };
  const bundle = {
    scene, sky, sun, renderer, skyEnvironment: new THREE.Texture(),
    bloom: { threshold: 5 },
    camera: new THREE.PerspectiveCamera(),
    controls: { target: new THREE.Vector3(), update: () => {} },
    look: { aim: () => {}, setPitch: () => {}, update: () => {} },
  } as unknown as SceneBundle;
  for (const role of ALL_ROLES) {
    vehicle.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: `role.${role}` })));
  }
  const slideout = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'role.body.paint' }));
  slideout.name = 'slideout_box';
  vehicle.add(slideout);
  vi.mocked(createScene).mockReturnValue(bundle);
  vi.mocked(loadModules).mockResolvedValue({ root: vehicle, loaded: ['shell', 'exterior'], missing: [] });
  await import('./main');
  const interiorEnvironment = scene.environment;
  const interiorBackground = scene.background;
  const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();

  // Always return through the exterior so every other stop must restore the entire subtree.
  for (const stop of HOTSPOTS.flatMap((h) => ['exterior', h.id])) {
    renderer.shadowMap.needsUpdate = false;
    click(`[data-hotspot="${stop}"]`);
    const exterior = stop === 'exterior';
    expect(scene.environment).toBe(exterior ? bundle.skyEnvironment : interiorEnvironment);
    expect(scene.environmentIntensity).toBe(exterior ? 0.45 : 2.5);
    // The threshold has to leave the sunlit body alone outdoors, or the vehicle blooms white.
    expect(bundle.bloom.threshold).toBe(exterior ? 12 : 5);
    expect(scene.background).toBe(exterior ? null : interiorBackground);
    expect([sky.visible, sun.visible]).toEqual([exterior, exterior]);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
    expect(renderer.clippingPlanes.map((p) => p.constant)).toEqual(stop === 'plan' ? [PLAN_CUT_MM / 1000] : []);
    const assertVisibility = () => {
      const effective = visibleMeshes();
      slideout.traverse((o) => {
        expect(o.visible).toBe(!exterior);
        if (o instanceof THREE.Mesh) expect(effective.includes(o)).toBe(!exterior);
      });
      for (const role of ALL_ROLES) {
        // Direct children only. slideout_box owns a second `batch.body.paint`, and it is added
        // to the vehicle before batchByRole runs, so a depth-first getObjectByName finds the
        // slide-out's copy — which is hidden at the exterior stop — rather than the body's.
        // The slide-out's own batch is covered by the traverse above.
        const batch = vehicle.children.find((o) => o.name === `batch.${role}`)!;
        expect(batch.visible)
          .toBe(EXTERIOR_ROLES.includes(role) ? ['exterior', 'plan'].includes(stop) : !exterior);
      }
    };
    assertVisibility();
    const state = [scene.environment, scene.environmentIntensity, scene.background];
    renderer.shadowMap.needsUpdate = false;
    click('[data-wood="oak"]');
    assertVisibility();
    expect([scene.environment, scene.environmentIntensity, scene.background]).toEqual(state);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
  }

  expect(probeFaces).toBe(6 * (1 + 2 * HOTSPOTS.length));
});

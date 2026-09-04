import { createScene } from './scene';
import { loadModules } from './loader';
import { buildGreybox } from './greybox';
import { applyFinishes } from './finishes';
import { installLighting } from './lighting';
import * as THREE from 'three';
import { bindPlacements } from './binding';
import { tweenTo } from './camera';
import { buildUi, WOOD_ROLES } from './ui';
import { checkAll } from './check';
import { HOTSPOTS } from './data/vehicle';
import { DEFAULT_REGISTRY } from './data/finishes';

const violations = checkAll();
if (violations.length) console.error('Dimensional violations:', violations);
else console.log('Dimensional checks pass.');

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const bundle = createScene(canvas);
const { root: vehicle, loaded, missing } = await loadModules(bundle.renderer);

if (loaded.length === 0) {
  // No modules built yet: fall back to the phase 1 grey-box so the app still runs.
  console.warn('No modules found in public/models — showing the grey-box.');
  vehicle.add(buildGreybox());
} else {
  console.log(`Loaded modules: ${loaded.join(', ')}`);
  if (missing.length) console.warn(`Not yet modelled: ${missing.join(', ')}`);
  // Only enforce the naming contract once every module exists, or a partial build fails here.
  if (missing.length === 0) bindPlacements(vehicle);
}

const registry = structuredClone(DEFAULT_REGISTRY);
applyFinishes(vehicle, registry);
bundle.scene.add(vehicle);

/**
 * The grey-box has no emissive LED strips and no window apertures, so the real lighting rig
 * has nothing to bounce off and renders a sealed box as near-black. Flat light until the
 * modules exist.
 */
const usingGreybox = loaded.length === 0;
let refreshProbe = () => {};

if (usingGreybox) {
  bundle.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 2);
  bundle.scene.add(key);
} else {
  ({ refreshProbe } = installLighting(bundle.scene, bundle.renderer, vehicle));
}

document.body.appendChild(
  buildUi({
    onHotspot: (id) => {
      const h = HOTSPOTS.find((x) => x.id === id);
      if (h) void tweenTo(bundle, h);
    },
    onWood: (variantId) => {
      for (const role of WOOD_ROLES) registry[role].active = variantId;
      applyFinishes(vehicle, registry);
      refreshProbe(); // the room's albedo changed, so the bounce light must too
    },
  }),
);

void tweenTo(bundle, HOTSPOTS[0]!, 0);
bundle.renderer.setAnimationLoop(bundle.render);

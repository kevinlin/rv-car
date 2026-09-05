/// <reference types="vite/client" />
import { createScene } from './scene';
import { loadModules } from './loader';
import { buildGreybox } from './greybox';
import { applyFinishes } from './finishes';
import { createTextureResolver } from './textures';
import { installLighting } from './lighting';
import * as THREE from 'three';
import { bindPlacements } from './binding';
import { tweenTo } from './camera';
import { buildUi, WOOD_ROLES } from './ui';
import { checkAll } from './check';
import { HOTSPOTS } from './data/vehicle';
import { DEFAULT_REGISTRY } from './data/finishes';
import { batchByRole } from './batching';

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
  console.log(`Role batches: ${batchByRole(vehicle)}`);
}

const registry = structuredClone(DEFAULT_REGISTRY);
const resolveTexture = createTextureResolver();
applyFinishes(vehicle, registry, resolveTexture);
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
      applyFinishes(vehicle, registry, resolveTexture);
      refreshProbe(); // the room's albedo changed, so the bounce light must too
    },
  }),
);

void tweenTo(bundle, HOTSPOTS[0]!, 0);
bundle.renderer.setAnimationLoop(bundle.render);

// Local verification only; production builds remove this branch.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('verify')) {
  let frames = 0, started = performance.now();
  // Live handle for camera and lighting tuning from the devtools console. refreshProbe is
  // included because cooling the cove tint only reaches the bounce light after a re-capture.
  Object.assign(window, { __rv: bundle, __refreshProbe: refreshProbe });
  canvas.dataset.loadedModules = loaded.join(',');
  canvas.dataset.boundPlacements = String(bindPlacements(vehicle).size);
  bundle.renderer.setAnimationLoop(() => {
    bundle.render();
    canvas.dataset.drawCalls = String(bundle.renderer.info.render.calls);
    canvas.dataset.triangles = String(bundle.renderer.info.render.triangles);
    if (++frames === 120) {
      canvas.dataset.fps = (120_000 / (performance.now() - started)).toFixed(1);
      frames = 0;
      started = performance.now();
    }
  });
}

if (import.meta.env.DEV && new URLSearchParams(location.search).has('calibrate')) {
  const { runCalibration } = await import('./calibrate');
  bundle.renderer.setAnimationLoop(null);
  const rows = await runCalibration(bundle);
  console.table(rows);
  canvas.dataset.calibration = JSON.stringify(rows);
  bundle.renderer.setAnimationLoop(bundle.render);
}

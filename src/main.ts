/// <reference types="vite/client" />
import { createScene } from './scene';
import { loadModules } from './loader';
import { buildGreybox } from './greybox';
import { applyFinishes, roleOf } from './finishes';
import { createTextureResolver } from './textures';
import { installLighting } from './lighting';
import * as THREE from 'three';
import { bindPlacements } from './binding';
import { tweenTo } from './camera';
import { buildUi, WOOD_ROLES } from './ui';
import { checkAll } from './check';
import { HOTSPOTS, PLAN_LABELS } from './data/vehicle';
import { DEFAULT_REGISTRY, EXTERIOR_ROLES, type Role } from './data/finishes';
import { batchByRole } from './batching';
import { buildLabels, createLabelLayer } from './labels';

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

// The dimension overlay for the plan stop. A DOM layer, so it costs no draw calls.
const labelGroup = buildLabels(PLAN_LABELS);
bundle.scene.add(labelGroup);
const labels = createLabelLayer(document.body, labelGroup);
let labelsWanted = true;
window.addEventListener('resize', () => labels.setSize(window.innerWidth, window.innerHeight));

/**
 * The grey-box has no emissive LED strips and no window apertures, so the real lighting rig
 * has nothing to bounce off and renders a sealed box as near-black. Flat light until the
 * modules exist.
 */
const usingGreybox = loaded.length === 0;
let refreshProbe = () => {};
/**
 * Show the body only at the stop that looks at it. From inside you never see your own
 * bodywork, and drawing it anyway cost the lounge 6 draw calls — 41 against a ceiling of 40.
 */
let showExterior = (_visible: boolean) => {};

if (usingGreybox) {
  bundle.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 2);
  bundle.scene.add(key);
} else {
  // Selected by role, not by node name. Every module's .glb root exports as "Scene", and
  // batchByRole has already merged the exterior into shared meshes by this point, so there is
  // no "exterior" node left to look up. The roles are the stable handle.
  const exteriorRoles = new Set<Role>(EXTERIOR_ROLES);
  const exterior: THREE.Object3D[] = [];
  vehicle.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.some((mat) => {
      const role = roleOf(mat.name);
      return role !== null && exteriorRoles.has(role);
    })) exterior.push(o);
  });
  ({ refreshProbe } = installLighting(bundle.scene, bundle.renderer, vehicle, exterior));
  showExterior = (visible) => { for (const o of exterior) o.visible = visible; };
}

/** Fly to a hotspot, showing the body only when the hotspot is the one that orbits it. */
const goTo = (h: (typeof HOTSPOTS)[number], ms?: number) => {
  showExterior(h.view.kind === 'orbit');
  labels.setVisible(h.id === 'plan' && labelsWanted);
  document.body.dataset.stop = h.id;   // the toggle button hides itself off this
  return tweenTo(bundle, h, ms);
};

document.body.appendChild(
  buildUi({
    onHotspot: (id) => {
      const h = HOTSPOTS.find((x) => x.id === id);
      if (h) void goTo(h);
    },
    onWood: (variantId) => {
      for (const role of WOOD_ROLES) registry[role].active = variantId;
      applyFinishes(vehicle, registry, resolveTexture);
      refreshProbe(); // the room's albedo changed, so the bounce light must too
    },
    onLabels: (on) => { labelsWanted = on; labels.setVisible(on); },
  }),
);

// The overview page links each thumbnail as tour.html#<stop id>, so open on that stop rather
// than always on the lounge. An unknown hash falls back instead of failing.
void goTo(HOTSPOTS.find((h) => h.id === location.hash.slice(1)) ?? HOTSPOTS[0]!, 0);
bundle.renderer.setAnimationLoop(() => {
  bundle.render();
  labels.render(bundle.scene, bundle.camera);
});

// Local verification only; production builds remove this branch.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('verify')) {
  let frames = 0, started = performance.now();
  // Live handle for camera and lighting tuning from the devtools console. refreshProbe is
  // included because cooling the cove tint only reaches the bounce light after a re-capture.
  Object.assign(window, { __rv: bundle, __refreshProbe: refreshProbe });
  canvas.dataset.loadedModules = loaded.join(',');
  canvas.dataset.boundPlacements = String(bindPlacements(vehicle).size);
  // The composer calls renderer.render once per pass, and each call resets the counters — so
  // without this the readout is whatever the last full-screen quad drew, which is 1. Reset once
  // per frame instead and the number covers the scene plus the post chain, which is what the
  // budget is actually spending.
  bundle.renderer.info.autoReset = false;
  bundle.renderer.setAnimationLoop(() => {
    bundle.renderer.info.reset();
    bundle.render();
    labels.render(bundle.scene, bundle.camera);
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
  bundle.renderer.setAnimationLoop(() => {
    bundle.render();
    labels.render(bundle.scene, bundle.camera);
  });
}

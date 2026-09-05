import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Hotspot } from './data/vehicle';
import type { SceneBundle } from './scene';

/** NaN-safe: a NaN progress value would propagate into the camera position and blank the frame. */
export const clamp = (v: number, lo: number, hi: number): number =>
  Number.isNaN(v) ? hi : v < lo ? lo : v > hi ? hi : v;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type OrbitView = Extract<Hotspot['view'], { kind: 'orbit' }>;

/** Constrain orbiting so the viewer cannot end up inside the vehicle or inside a wall. */
export const applyHotspotLimits = (
  controls: OrbitControls,
  camera: THREE.Camera,
  target: readonly [number, number, number],
  view: OrbitView,
): void => {
  const centreAzimuth = Math.atan2(
    camera.position.x - target[0]!,
    camera.position.z - target[2]!,
  );
  controls.minAzimuthAngle = centreAzimuth + view.azimuth[0]!;
  controls.maxAzimuthAngle = centreAzimuth + view.azimuth[1]!;
  controls.minPolarAngle = view.polar[0]!;
  controls.maxPolarAngle = view.polar[1]!;
  controls.minDistance = view.distance[0]!;
  controls.maxDistance = view.distance[1]!;
  controls.update();
};

/** Hand the camera to whichever controller this hotspot's view calls for. */
const arrive = (bundle: SceneBundle, h: Hotspot): void => {
  const { camera, controls, look } = bundle;
  if (h.view.kind === 'look') {
    controls.enabled = false;
    look.enabled = true;
    look.setPitch(h.view.pitch);
    look.aim(h.camera.position, h.camera.target);
    look.update();
  } else {
    look.enabled = false;
    controls.enabled = true;
    applyHotspotLimits(controls, camera, h.camera.target, h.view);
  }
};

/** Fly the camera to a hotspot, then hand it to that hotspot's controller. */
export const tweenTo = (bundle: SceneBundle, h: Hotspot, ms = 900): Promise<void> => {
  const { camera, controls } = bundle;

  // Limits must be released for the flight, or the tween fights the clamp. Polar included:
  // the previous hotspot's polar floor otherwise drags the arrival pose off its target.
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  // Neither controller may fight the flight.
  controls.enabled = false;
  bundle.look.enabled = false;

  // Zero duration means "place it now" — used for the opening shot.
  if (ms <= 0) {
    camera.position.set(...(h.camera.position as [number, number, number]));
    controls.target.set(...(h.camera.target as [number, number, number]));
    arrive(bundle, h);
    return Promise.resolve();
  }

  const fromPos = camera.position.clone();
  const fromTgt = controls.target.clone();
  const toPos = new THREE.Vector3(...h.camera.position);
  const toTgt = new THREE.Vector3(...h.camera.target);
  const start = performance.now();

  return new Promise((resolve) => {
    const step = () => {
      const t = clamp((performance.now() - start) / ms, 0, 1);
      const k = easeInOutCubic(t);
      camera.position.lerpVectors(fromPos, toPos, k);
      controls.target.lerpVectors(fromTgt, toTgt, k);
      controls.update();

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        arrive(bundle, h);
        resolve();
      }
    };
    step();
  });
};

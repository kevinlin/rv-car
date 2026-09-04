import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Hotspot } from './data/vehicle';
import type { SceneBundle } from './scene';

/** NaN-safe: a NaN progress value would propagate into the camera position and blank the frame. */
export const clamp = (v: number, lo: number, hi: number): number =>
  Number.isNaN(v) ? hi : v < lo ? lo : v > hi ? hi : v;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Constrain orbiting so the viewer cannot end up outside the vehicle or inside a wall. */
export const applyHotspotLimits = (controls: OrbitControls, h: Hotspot): void => {
  const centreAzimuth = Math.atan2(
    h.camera.position[0] - h.camera.target[0],
    h.camera.position[2] - h.camera.target[2],
  );
  controls.minAzimuthAngle = centreAzimuth + h.orbit.azimuth[0];
  controls.maxAzimuthAngle = centreAzimuth + h.orbit.azimuth[1];
  controls.minPolarAngle = h.orbit.polar[0];
  controls.maxPolarAngle = h.orbit.polar[1];
  controls.minDistance = h.orbit.distance[0];
  controls.maxDistance = h.orbit.distance[1];
  controls.update();
};

/** Fly the camera to a hotspot, then re-apply that hotspot's orbit limits. */
export const tweenTo = (bundle: SceneBundle, h: Hotspot, ms = 900): Promise<void> => {
  const { camera, controls } = bundle;

  // Limits must be released for the flight, or the tween fights the clamp.
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  controls.enabled = false;

  // Zero duration means "place it now" — used for the opening shot.
  if (ms <= 0) {
    camera.position.set(...(h.camera.position as [number, number, number]));
    controls.target.set(...(h.camera.target as [number, number, number]));
    controls.enabled = true;
    applyHotspotLimits(controls, h);
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
        controls.enabled = true;
        applyHotspotLimits(controls, h);
        resolve();
      }
    };
    step();
  });
};

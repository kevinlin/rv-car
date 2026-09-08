import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { SceneBundle } from './scene';

export interface CoveSpec {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly intensity: number;
}

/**
 * Cove tint, and the single knob that fixes the render's warm cast.
 *
 * At the old 0xffd9a0 every neutral in the room measured 0.11 to 0.19 saturation against
 * photographs that measure 0.015 to 0.034. Cooling it to a warm white lands all three
 * calibration patches near 0.045. `environmentIntensity` is deliberately NOT the lever: the
 * probe cubemap carries the cool daylight arriving through the glazing and the roof hatch, so
 * lowering it concentrates the coves' orange instead of diluting it — dropping it to 1.2 took
 * the floor patch from 0.155 to 0.245. The `led.cove` emissive stays at 0xffd9a0, because the
 * strips are meant to look warm in frame and they are too small to move the measurement.
 */
const WARM = 0xffeed8;

/**
 * Four RectAreaLights: one per ceiling cove, split fore and aft so the long cabin does not
 * fall off in the middle. Deliberately few — the environment probe supplies the bounce, and
 * RectAreaLights are the expensive part of this scene.
 */
export const coveLightSpecs = (): CoveSpec[] => [
  { position: [-1.05, 1.92, 0.9], lookAt: [-0.2, 0.9, 0.9], width: 1.8, height: 0.06, intensity: 26 },
  { position: [-1.05, 1.92, 2.9], lookAt: [-0.2, 0.9, 2.9], width: 1.8, height: 0.06, intensity: 26 },
  { position: [1.05, 1.92, 0.9],  lookAt: [0.2, 0.9, 0.9],  width: 1.8, height: 0.06, intensity: 26 },
  { position: [1.05, 1.92, 2.9],  lookAt: [0.2, 0.9, 2.9],  width: 1.8, height: 0.06, intensity: 26 },
];

export const installLighting = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  vehicle: THREE.Object3D,
  /** Held out of the probe capture: an opaque body around the cabin would black it out. */
  exterior: readonly THREE.Object3D[],
  { sky, sun }: Pick<SceneBundle, 'sky' | 'sun'>,
) => {
  RectAreaLightUniformsLib.init();

  for (const spec of coveLightSpecs()) {
    const light = new THREE.RectAreaLight(WARM, spec.intensity, spec.width, spec.height);
    light.position.set(...(spec.position as [number, number, number]));
    light.lookAt(new THREE.Vector3(...(spec.lookAt as [number, number, number])));
    scene.add(light);
  }

  // Interior daylight through the roof hatch, retained alongside the exterior sun.
  const hatch = new THREE.DirectionalLight(0xdfe9ff, 2.5);
  hatch.position.set(0.3, 6, 1.2);
  hatch.target.position.set(0, 0, 1.4);
  hatch.castShadow = true;
  hatch.shadow.mapSize.set(1024, 1024);
  hatch.shadow.camera.near = 1;
  hatch.shadow.camera.far = 12;
  scene.add(hatch, hatch.target);

  /**
   * The trick that replaces a lightmap: render the cabin to a cubemap with the LED strips
   * emissive, and use the result as the scene environment. One pass buys most of the bounce
   * light, and unlike a bake it does not pin the furniture in place.
   */
  const cubeTarget = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const probeCamera = new THREE.CubeCamera(0.1, 20, cubeTarget);
  probeCamera.position.set(0, 1.2, 1.6);
  scene.add(probeCamera);
  const interiorBackground = scene.background;
  scene.environment = cubeTarget.texture;
  scene.environmentIntensity = 2.5;
  renderer.shadowMap.autoUpdate = false;

  const refreshProbe = () => {
    // Toggling visibility rather than juggling render layers is deliberate: CubeCamera holds
    // six child cameras, and setting layers on the parent does not propagate to all of them.
    const hidden = [...exterior, sky, sun];
    const wasVisible = hidden.map((o) => o.visible);
    const { environment, environmentIntensity, background } = scene;
    // The plan stop sections the vehicle at PLAN_CUT_MM. The probe camera stands inside the
    // cabin, so capturing with that plane set replaces the ceiling with sky and relights every
    // interior material. Same trap as the exterior body two lines up, same fix.
    const clipping = renderer.clippingPlanes;
    try {
      for (const o of hidden) o.visible = false;
      renderer.clippingPlanes = [];
      scene.environment = null;
      scene.environmentIntensity = 1;
      scene.background = interiorBackground;
      // The capture needs hatch shadows without the body. The first cube face consumes this
      // flag, so invalidate again after restoring visibility for the next screen render.
      renderer.shadowMap.needsUpdate = true;
      probeCamera.update(renderer, scene);
    } finally {
      renderer.clippingPlanes = clipping;
      hidden.forEach((o, i) => { o.visible = wasVisible[i]!; });
      scene.environment = environment;
      scene.environmentIntensity = environmentIntensity;
      scene.background = background;
      // Global section planes are excluded by WebGLClipping during shadow rendering: the
      // plan stop's clipped roof still casts a shadow, rather than admitting false daylight.
      renderer.shadowMap.needsUpdate = true;
    }
  };

  vehicle.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  refreshProbe();
  return { refreshProbe };
};

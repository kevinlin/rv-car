import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export interface CoveSpec {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly intensity: number;
}

const WARM = 0xffd9a0;

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
) => {
  RectAreaLightUniformsLib.init();

  for (const spec of coveLightSpecs()) {
    const light = new THREE.RectAreaLight(WARM, spec.intensity, spec.width, spec.height);
    light.position.set(...(spec.position as [number, number, number]));
    light.lookAt(new THREE.Vector3(...(spec.lookAt as [number, number, number])));
    scene.add(light);
  }

  // Daylight through the roof hatch — the only shadow caster in the scene.
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

  const refreshProbe = () => {
    // Geometry and the hatch light are static. Rebuild shadows with the probe, not every
    // camera frame; future furniture moves can call this same refresh function.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    scene.environment = null;
    probeCamera.update(renderer, scene);
    scene.environment = cubeTarget.texture;
    scene.environmentIntensity = 2.5;
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

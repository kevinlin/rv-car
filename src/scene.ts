import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createLook, type LookControls } from './look';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  look: LookControls;
  composer: EffectComposer;
  render: () => void;
}

export const createScene = (canvas: HTMLCanvasElement): SceneBundle => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Daylight standing in for the world outside: the glazing is 24 % opaque, so without a bright
  // background the windows read as grey holes instead of the blown-out openings in the reference.
  scene.background = new THREE.Color(0xeef3fb);

  // The world outside, so the exterior stop has something to stand on and the glazing has
  // something to reflect. The parent spec records both as known gaps.
  const sky = new THREE.HemisphereLight(0xdcecff, 0x6a6257, 0.6);
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6f7276, roughness: 0.95 }),
  );
  ground.position.y = -1.05; // floorAboveGround, in metres
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(2.6, 1.9, 4.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 1.6);
  controls.enableDamping = true;

  const look = createLook(camera, renderer.domElement);

  /**
   * The post chain section 7 has asked for since the first pass and no pass had shipped.
   *
   * Bloom is the load-bearing one: it is what makes an LED cove strip read as a light source
   * rather than a white stripe, and the video's whole look is strips glowing against dark
   * walnut. Threshold sits above the cream panels (which clip around 0.9 after tone mapping)
   * and below the emissive strips, so only the strips bloom.
   *
   * **GTAO was measured and cut.** Section 7 asks for it too, and it works, but it re-renders
   * the whole scene twice for depth and normals: at a true 1920 x 1080 buffer it took the
   * lounge from 120 fps to 40.4 and the washroom to 39.2, against a success criterion of 60,
   * and interior draw calls from 45 to 79. Bloom alone holds 120 fps at every stop. The AO
   * bake already supplies contact shading, so GTAO was buying a second-order effect for
   * two-thirds of the frame budget. Do not re-add it without re-measuring; the numbers are in
   * the spec's implementation record.
   *
   * OutputPass owns tone mapping and the sRGB conversion once the chain exists; leaving it on
   * the renderer as well would apply ACES twice.
   */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55, // strength
    0.45, // radius
    // Threshold is in LINEAR HDR, not in the tone-mapped output: RenderPass writes a float
    // target and OutputPass applies ACES at the end, so a value picked as if it were display
    // luminance catches everything. At the textbook 0.92 the cream panels and the daylight
    // behind the glazing bloomed along with the strips and the whole cabin fogged over. The
    // led.cove emissive runs at 14, the panels sit nearer 1 to 3, so 5.0 divides them.
    5.0,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Exactly one controller drives the camera at a time; tweenTo hands over on arrival.
  const render = () => {
    if (look.enabled) look.update();
    else controls.update();
    composer.render();
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, look, composer, render };
};

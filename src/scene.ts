import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLook, type LookControls } from './look';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  look: LookControls;
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

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(2.6, 1.9, 4.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 1.6);
  controls.enableDamping = true;

  const look = createLook(camera, renderer.domElement);

  // Exactly one controller drives the camera at a time; tweenTo hands over on arrival.
  const render = () => {
    if (look.enabled) look.update();
    else controls.update();
    renderer.render(scene, camera);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, look, render };
};

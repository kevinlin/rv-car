import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { labelAnchorM, labelDetail, type PlanLabel } from './data/vehicle';

/**
 * Labels for the plan stop, as a DOM layer over the canvas rather than as sprites.
 *
 * Sprites would cost draw calls at a stop that already carries the exterior body, go blurry
 * when zoomed, and need billboarding. CSS2DRenderer draws nothing on the GPU and keeps the
 * text crisp at every distance.
 */
export const buildLabels = (labels: readonly PlanLabel[]): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'plan-labels';
  group.visible = false;

  for (const l of labels) {
    const el = document.createElement('div');
    el.className = 'plan-label';
    const name = document.createElement('strong');
    name.textContent = l.text;
    const detail = document.createElement('span');
    detail.textContent = labelDetail(l);
    el.append(name, detail);

    const object = new CSS2DObject(el);
    object.position.set(...labelAnchorM(l));
    group.add(object);
  }
  return group;
};

export interface LabelLayer {
  setVisible(on: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(w: number, h: number): void;
}

/** The DOM layer the labels live in. Transparent, and never eats a pointer event. */
export const createLabelLayer = (parent: HTMLElement, group: THREE.Group): LabelLayer => {
  const renderer = new CSS2DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(renderer.domElement.style, {
    position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
  });
  parent.appendChild(renderer.domElement);

  return {
    setVisible: (on) => { group.visible = on; },
    // Unconditional: CSS2DRenderer hides the DOM node of every child of an invisible object,
    // so gating this on group.visible would leave the last frame's labels frozen on screen
    // when the toggle goes off.
    render: (scene, camera) => renderer.render(scene, camera),
    setSize: (w, h) => renderer.setSize(w, h),
  };
};

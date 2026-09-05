import * as THREE from 'three';

/**
 * Yaw and pitch about a fixed eye point.
 *
 * OrbitControls cannot do this job. It swings the camera around a target at a radius, and the
 * habitation box is 2.36 m wide, so a full turn at any useful radius puts the camera through a
 * wall. Look mode leaves the eye where the hotspot put it and only turns the head.
 */

export interface Heading {
  readonly yaw: number;
  readonly pitch: number;
}

/** Yaw/pitch that points a default -Z camera at `to` from `from`. YXZ order. */
export const headingOf = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): Heading => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return {
    yaw: Math.atan2(dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
  };
};

export const clampPitch = (pitch: number, limits: readonly [number, number]): number =>
  pitch < limits[0] ? limits[0] : pitch > limits[1] ? limits[1] : pitch;

export interface LookControls {
  enabled: boolean;
  /** Point at a world position and adopt that as the new centre. */
  aim(from: readonly [number, number, number], to: readonly [number, number, number]): void;
  setPitch(limits: readonly [number, number]): void;
  update(): void;
  dispose(): void;
}

const SPEED = 0.0026; // radians per pixel of drag

export const createLook = (
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
): LookControls => {
  let yaw = 0;
  let pitch = 0;
  let pitchLimits: readonly [number, number] = [-Math.PI / 3, Math.PI / 3];
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dirty = true;

  const controls: LookControls = {
    enabled: false,
    aim(from, to) {
      const h = headingOf(from, to);
      yaw = h.yaw;
      pitch = clampPitch(h.pitch, pitchLimits);
      dirty = true;
    },
    setPitch(limits) {
      pitchLimits = limits;
      pitch = clampPitch(pitch, pitchLimits);
      dirty = true;
    },
    update() {
      if (!dirty) return;
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      dirty = false;
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
    },
  };

  function onDown(e: PointerEvent) {
    if (!controls.enabled) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dom.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging || !controls.enabled) return;
    // Drag left to look left: the world should follow the pointer.
    yaw -= (e.clientX - lastX) * SPEED;
    pitch = clampPitch(pitch + (e.clientY - lastY) * SPEED, pitchLimits);
    lastX = e.clientX;
    lastY = e.clientY;
    dirty = true;
  }

  function onUp(e: PointerEvent) {
    dragging = false;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
  }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);

  return controls;
};

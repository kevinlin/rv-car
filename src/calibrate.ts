import type * as THREE from 'three';
import type { Role } from './data/finishes';
import type { ZoneId } from './data/vehicle';
import { HOTSPOTS } from './data/vehicle';
import { tweenTo } from './camera';
import type { SceneBundle } from './scene';

/** HSV saturation of an 8-bit RGB triple. */
export const saturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

export interface Patch {
  readonly label: string;
  readonly role: Role;
  readonly hotspot: ZoneId;
  /** Normalised viewport coordinates, origin top-left. */
  readonly u: number;
  readonly v: number;
}

/**
 * Each must land on bare material — no prop, no highlight, no cove strip. Verified against a
 * marked screenshot; adjust `u`/`v` and reload if a patch drifts onto something else.
 */
export const PATCHES: readonly Patch[] = [
  { label: 'aisle floor',   role: 'floor',            hotspot: 'dinette',  u: 0.46, v: 0.86 },
  { label: 'chair panel',   role: 'upholstery.seat',  hotspot: 'dinette',  u: 0.72, v: 0.62 },
  { label: 'washroom wall', role: 'washroom.shell',   hotspot: 'washroom', u: 0.30, v: 0.40 },
];

/** Mean colour of a square of the drawing buffer. Call immediately after a render. */
export const samplePatch = (
  renderer: THREE.WebGLRenderer,
  u: number,
  v: number,
  size = 8,
): [number, number, number] => {
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  // readPixels' origin is bottom-left; Patch coordinates are top-left.
  const x = Math.round(u * w - size / 2);
  const y = Math.round((1 - v) * h - size / 2);
  const buf = new Uint8Array(size * size * 4);
  gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buf);

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < size * size; i++) {
    r += buf[i * 4]!; g += buf[i * 4 + 1]!; b += buf[i * 4 + 2]!;
  }
  const n = size * size;
  return [r / n, g / n, b / n];
};

export interface CalibrationRow {
  readonly label: string;
  readonly hex: string;
  readonly saturation: number;
  readonly pass: boolean;
}

export const MAX_RENDERED_SATURATION = 0.08;

/** Visits each patch's hotspot, samples it, and returns one row per patch. */
export const runCalibration = async (bundle: SceneBundle): Promise<CalibrationRow[]> => {
  const rows: CalibrationRow[] = [];

  for (const patch of PATCHES) {
    const hotspot = HOTSPOTS.find((h) => h.id === patch.hotspot);
    if (!hotspot) continue;
    await tweenTo(bundle, hotspot, 0);
    bundle.render();
    const [r, g, b] = samplePatch(bundle.renderer, patch.u, patch.v);
    const sat = saturation(r, g, b);
    const hx = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    rows.push({
      label: patch.label,
      hex: `#${hx(r)}${hx(g)}${hx(b)}`,
      saturation: Number(sat.toFixed(3)),
      pass: sat < MAX_RENDERED_SATURATION,
    });
  }

  return rows;
};

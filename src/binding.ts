import type * as THREE from 'three';
import { PLACEMENTS, type Placement } from './data/vehicle';

export class BindingError extends Error {
  constructor(missing: readonly string[]) {
    super(
      `glTF is missing ${missing.length} node(s) named in the placement data: ${missing.join(', ')}. ` +
        'Object names in model/rv.blend must equal the placement id in src/data/vehicle.ts.',
    );
    this.name = 'BindingError';
  }
}

/**
 * Resolve every placement id to a node in the loaded tree.
 * Throws listing all missing ids at once — a Blender rename should be one fix, not a game of
 * whack-a-mole through repeated failures.
 */
export const bindPlacements = (
  root: THREE.Object3D,
  ps: readonly Placement[] = PLACEMENTS,
): Map<string, THREE.Object3D> => {
  const found = new Map<string, THREE.Object3D>();
  const missing: string[] = [];

  for (const p of ps) {
    const node = root.getObjectByName(p.id);
    if (node) found.set(p.id, node);
    else missing.push(p.id);
  }

  if (missing.length) throw new BindingError(missing);
  return found;
};

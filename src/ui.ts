import { HOTSPOTS, type StopId } from './data/vehicle';
import { DEFAULT_REGISTRY, type Role } from './data/finishes';

/**
 * Every timber role swaps together — cabinets, trim and the gloss locker fronts are one veneer
 * in a real vehicle, and the walkthrough video shows the lockers are timber rather than the
 * cream the first palette pass read off the stills.
 */
export const WOOD_ROLES: Role[] = ['wood.cabinet', 'wood.trim', 'panel.locker'];

export interface UiOptions {
  onHotspot: (id: StopId) => void;
  onWood: (variantId: string) => void;
}

export const buildUi = (opts: UiOptions): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'ui';

  const zones = document.createElement('nav');
  zones.className = 'ui-zones';
  for (const h of HOTSPOTS) {
    const b = document.createElement('button');
    b.dataset.hotspot = h.id;
    b.textContent = h.label;
    b.addEventListener('click', () => opts.onHotspot(h.id));
    zones.appendChild(b);
  }

  const finishes = document.createElement('div');
  finishes.className = 'ui-finishes';
  for (const v of DEFAULT_REGISTRY['wood.cabinet'].variants) {
    const b = document.createElement('button');
    b.dataset.wood = v.id;
    b.title = v.label;
    b.style.background = `#${v.params.color.toString(16).padStart(6, '0')}`;
    b.addEventListener('click', () => opts.onWood(v.id));
    finishes.appendChild(b);
  }

  root.append(zones, finishes);
  return root;
};

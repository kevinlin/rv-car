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
  onLabels: (on: boolean) => void;
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

  // Shown only at the plan stop; the page's stylesheet hides it off body[data-stop="plan"],
  // because a dimension overlay has nothing to label from inside the cabin.
  const toggle = document.createElement('button');
  toggle.dataset.labels = 'toggle';
  toggle.textContent = 'Labels';
  toggle.setAttribute('aria-pressed', 'true');
  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    opts.onLabels(on);
  });

  // Same stops as a native dropdown, for widths where eight buttons no longer fit. The
  // stylesheet shows exactly one of the two. Its value follows body[data-stop], which goTo()
  // stamps, so a hash arrival or a click on a wide-screen button leaves it correct.
  const select = document.createElement('select');
  select.className = 'ui-stops';
  select.setAttribute('aria-label', 'Stop');
  for (const h of HOTSPOTS) {
    const o = document.createElement('option');
    o.value = h.id;
    o.textContent = h.label;
    select.appendChild(o);
  }
  select.addEventListener('change', () => opts.onHotspot(select.value as StopId));
  new MutationObserver(() => { select.value = document.body.dataset.stop ?? ''; })
    .observe(document.body, { attributeFilter: ['data-stop'] });

  root.append(zones, select, finishes, toggle);
  return root;
};

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildUi, WOOD_ROLES } from './ui';
import { HOTSPOTS } from './data/vehicle';
import { DEFAULT_REGISTRY } from './data/finishes';

describe('WOOD_ROLES', () => {
  it('covers every timber role, so a swap restyles cabinets, trim and lockers together', () => {
    expect(WOOD_ROLES).toEqual(['wood.cabinet', 'wood.trim', 'panel.locker']);
  });

  it('gives every timber role the same variant ids, or a swap would half-apply', () => {
    const ids = (r: (typeof WOOD_ROLES)[number]) =>
      DEFAULT_REGISTRY[r].variants.map((v) => v.id);
    for (const role of WOOD_ROLES) expect(ids(role)).toEqual(ids('wood.cabinet'));
  });
});

describe('buildUi', () => {
  it('renders one button per hotspot', () => {
    const el = buildUi({ onHotspot: vi.fn(), onWood: vi.fn() });
    expect(el.querySelectorAll('[data-hotspot]').length).toBe(HOTSPOTS.length);
  });

  it('renders one swatch per wood variant', () => {
    const el = buildUi({ onHotspot: vi.fn(), onWood: vi.fn() });
    expect(el.querySelectorAll('[data-wood]').length)
      .toBe(DEFAULT_REGISTRY['wood.cabinet'].variants.length);
  });

  it('calls back with the hotspot id when a button is clicked', () => {
    const onHotspot = vi.fn();
    const el = buildUi({ onHotspot, onWood: vi.fn() });
    (el.querySelector('[data-hotspot="galley"]') as HTMLButtonElement).click();
    expect(onHotspot).toHaveBeenCalledWith('galley');
  });

  it('calls back with the variant id when a swatch is clicked', () => {
    const onWood = vi.fn();
    const el = buildUi({ onHotspot: vi.fn(), onWood });
    (el.querySelector('[data-wood="oak"]') as HTMLButtonElement).click();
    expect(onWood).toHaveBeenCalledWith('oak');
  });
});

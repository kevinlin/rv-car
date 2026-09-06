import { describe, it, expect } from 'vitest';
import { assetUrl, MODULE_NAMES } from './loader';

describe('assetUrl', () => {
  // A wrong base is invisible until the site is on Pages, where every model and texture 404s
  // and the app silently falls back to the grey-box. Cheap to guard here.
  it('joins the deployment base to a registry path without doubling the slash', () => {
    expect(assetUrl('/models/shell.glb')).toBe(`${import.meta.env.BASE_URL}models/shell.glb`);
    expect(assetUrl('/models/shell.glb')).not.toContain('//');
  });

  it('leaves an already-relative path alone', () => {
    expect(assetUrl('textures/walnut.webp')).toBe(`${import.meta.env.BASE_URL}textures/walnut.webp`);
  });
});

describe('MODULE_NAMES', () => {
  it('lists the ten exported collections', () => {
    expect(MODULE_NAMES).toHaveLength(10);
    expect(new Set(MODULE_NAMES).size).toBe(10);
  });
});

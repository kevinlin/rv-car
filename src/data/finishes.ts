export type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass';

/**
 * A texture described, not loaded. This file imports nothing, so it cannot hold a
 * THREE.Texture — src/textures.ts turns one of these into one at runtime.
 */
export interface TextureSpec {
  readonly url: string;
  /**
   * UV tiling. Defaults to [1, 1]. UVMap is normalised to 1.0 UV units per metre by
   * `normalise_uv_density()` in the Blender pipeline, so a repeat reads as tiles per metre.
   */
  readonly repeat?: readonly [number, number];
  /** Base colour is sRGB; normal and data maps are not. Defaults to true. */
  readonly srgb?: boolean;
}

export interface MaterialParams {
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly map?: TextureSpec;
  readonly normalMap?: TextureSpec;
  readonly normalScale?: number;
  readonly transparent?: boolean;
}

export interface Variant {
  readonly id: string;
  readonly label: string;
  readonly params: MaterialParams;
}

export type Registry = Record<Role, { active: string; variants: Variant[] }>;

const one = (id: string, label: string, params: MaterialParams) => ({
  active: id,
  variants: [{ id, label, params }],
});

/** Colours are estimated from the reference imagery — see the research note's palette table. */
export const DEFAULT_REGISTRY: Registry = {
  'wood.cabinet': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.45, metalness: 0 } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.55, metalness: 0 } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.6,  metalness: 0 } },
    ],
  },
  'wood.trim': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.35, metalness: 0 } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.45, metalness: 0 } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.5,  metalness: 0 } },
    ],
  },
  'panel.wall':        one('bone', 'Bone', { color: 0xefe7da, roughness: 0.8, metalness: 0 }),
  'panel.locker':      one('bone-gloss', 'Bone gloss', { color: 0xefe7da, roughness: 0.25, metalness: 0 }),
  // Photographs sample #808182 in shadow; the albedo is lighter than the pixel.
  'upholstery.seat':   one('grey', 'Grey leather', { color: 0xc9cac9, roughness: 0.7, metalness: 0 }),
  'upholstery.bolster':one('camel', 'Camel leather', { color: 0xb08052, roughness: 0.7, metalness: 0 }),
  'upholstery.sofa':   one('white-cream', 'White cream leather', { color: 0xf2ede4, roughness: 0.7, metalness: 0 }),
  'worktop':           one('grey-stone', 'Grey stone', { color: 0xc9c6be, roughness: 0.35, metalness: 0 }),
  // Sampled from the reference aisle shot at #8f9094 — a cool neutral, not the warm grey
  // the first palette pass estimated by eye.
  'floor':             one('grey-vinyl', 'Grey vinyl', { color: 0x8f9094, roughness: 0.75, metalness: 0 }),
  'washroom.shell':    one('gloss-white', 'Gloss white GRP', { color: 0xf7f7f5, roughness: 0.15, metalness: 0 }),
  'washroom.duckboard':one('teak', 'Teak', { color: 0x9a6b3c, roughness: 0.6, metalness: 0 }),
  'metal.brushed':     one('aluminium', 'Brushed aluminium', { color: 0xb8bcc0, roughness: 0.35, metalness: 1 }),
  'metal.chrome':      one('chrome', 'Chrome', { color: 0xffffff, roughness: 0.05, metalness: 1 }),
  'metal.dark':        one('black', 'Matt black', { color: 0x1e1e1e, roughness: 0.4, metalness: 0.8 }),
  'textile.curtain':   one('sand', 'Sand', { color: 0xd9cfbe, roughness: 0.95, metalness: 0 }),
  'led.cove': {
    active: 'warm',
    variants: [
      { id: 'warm',    label: 'Warm white',    params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffd9a0, emissiveIntensity: 14 } },
      { id: 'neutral', label: 'Neutral white', params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xfff3e0, emissiveIntensity: 14 } },
    ],
  },
  // Emissive rather than transparent: the world outside is not modelled, so the panes are lit
  // to read as blown-out daylight openings the way the reference shots do.
  'glass':             one('clear', 'Clear', { color: 0xdfe6ea, roughness: 0.05, metalness: 0, emissive: 0xeef4ff, emissiveIntensity: 1.4 }),
};

export const ALL_ROLES = Object.keys(DEFAULT_REGISTRY) as Role[];

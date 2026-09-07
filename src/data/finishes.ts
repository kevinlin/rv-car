export type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass'
  | 'graphic.print' | 'graphic.screen'
  | 'body.paint' | 'body.graphic' | 'tyre' | 'wheel';

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
  // One grain photograph tinted three ways, at a coarser repeat for ash. This is what moving
  // maps into the registry buys: a variant can carry its own grain, not only its own tint.
  // wood.trim shares the image because the reference shows one veneer on both the cabinets and
  // the ceiling band.
  'wood.cabinet': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.45, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.55, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.6,  metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] } } },
    ],
  },
  'wood.trim': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.35, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.45, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.5,  metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] } } },
    ],
  },
  'panel.wall':        one('bone', 'Bone', { color: 0xefe7da, roughness: 0.8, metalness: 0 }),
  // Gloss walnut, not bone. The walkthrough video shows the locker fronts as the same timber as
  // the cabinets, lacquered: strong specular highlights over visible grain, in a dark charcoal
  // surround. The first palette pass read them as cream doors in a walnut frame, which is what
  // the stills suggest at brochure resolution. Because they are timber they take the wood
  // variants too, and `WOOD_ROLES` swaps them with the cabinetry — a locker run left walnut
  // beside oak cabinets would be a worse lie than the one this fixes.
  'panel.locker': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x6b4a2f, roughness: 0.12, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xb98d5a, roughness: 0.16, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xe2cfae, roughness: 0.20, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] } } },
    ],
  },
  // Photographs sample #808182 in shadow; the albedo is lighter than the pixel.
  'upholstery.seat':   one('grey', 'Grey leather', { color: 0xc9cac9, roughness: 0.7, metalness: 0,
    map: { url: '/textures/leather-grey.webp', repeat: [4, 4] } }),
  'upholstery.bolster':one('camel', 'Camel leather', { color: 0xb08052, roughness: 0.7, metalness: 0,
    map: { url: '/textures/leather-camel.webp', repeat: [4, 4] } }),
  'upholstery.sofa':   one('white-cream', 'White cream leather', { color: 0xf2ede4, roughness: 0.7, metalness: 0,
    map: { url: '/textures/leather-cream.webp', repeat: [3, 3] } }),
  'worktop':           one('grey-stone', 'Grey stone', { color: 0xc9c6be, roughness: 0.35, metalness: 0,
    map: { url: '/textures/stone.webp', repeat: [1.5, 1.5] } }),
  // Sampled from the reference aisle shot at #8f9094 — a cool neutral, not the warm grey
  // the first palette pass estimated by eye.
  'floor':             one('grey-vinyl', 'Grey vinyl', { color: 0x8f9094, roughness: 0.75, metalness: 0,
    map: { url: '/textures/herringbone.webp', repeat: [4, 4] } }),
  'washroom.shell':    one('gloss-white', 'Gloss white GRP', { color: 0xf7f7f5, roughness: 0.15, metalness: 0,
    map: { url: '/textures/grp-ribbed.webp', repeat: [2, 2] } }),
  'washroom.duckboard':one('teak', 'Teak', { color: 0x9a6b3c, roughness: 0.6, metalness: 0 }),
  'metal.brushed':     one('aluminium', 'Brushed aluminium', { color: 0xb8bcc0, roughness: 0.35, metalness: 1 }),
  'metal.chrome':      one('chrome', 'Chrome', { color: 0xffffff, roughness: 0.05, metalness: 1 }),
  'metal.dark':        one('black', 'Matt black', { color: 0x1e1e1e, roughness: 0.4, metalness: 0.8 }),
  'textile.curtain':   one('sand', 'Sand', { color: 0xd9cfbe, roughness: 0.95, metalness: 0,
    map: { url: '/textures/damask.webp', repeat: [6, 6] } }),
  'led.cove': {
    active: 'warm',
    variants: [
      { id: 'warm',    label: 'Warm white',    params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffd9a0, emissiveIntensity: 14 } },
      { id: 'neutral', label: 'Neutral white', params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xfff3e0, emissiveIntensity: 14 } },
    ],
  },
  // Flat graphics: framed art and the photo wall carry their image, the systems panel and TV
  // glow. Both keep color white so the photographic map is not tinted a second time.
  'graphic.print':  one('photo-wall', 'Photo wall', {
    color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true,
    map: { url: '/textures/photo-wall.webp' },
  }),
  'graphic.screen': one('systems', 'Systems panel', {
    color: 0xffffff, roughness: 0.2, metalness: 0,
    emissive: 0x3a6ea8, emissiveIntensity: 2.2,
    map: { url: '/textures/systems-panel.webp' },
  }),
  // Emissive rather than transparent: the world outside is not modelled, so the panes are lit
  // to read as blown-out daylight openings the way the reference shots do.
  'glass':             one('clear', 'Clear', { color: 0xdfe6ea, roughness: 0.05, metalness: 0, emissive: 0xeef4ff, emissiveIntensity: 1.4 }),

  'body.paint':   one('white-grp', 'White GRP', { color: 0xf2f3f2, roughness: 0.35, metalness: 0 }),
  // The map is a stripe band rather than the full livery, and it tiles. The exterior body is
  // smart-projected, so its UV islands start at 0.034 and span 4.01 over a 3.4 m panel: no
  // repeat maps one copy onto the flank without cutting it, which is why the artwork carries
  // no lettering to cut. See model/textures.json.
  'body.graphic': one('side-decal', 'Side decal', {
    color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true,
    map: { url: '/textures/side-graphic.webp', repeat: [1, 2] },
  }),
  'tyre':         one('rubber', 'Rubber', { color: 0x1a1a1c, roughness: 0.9, metalness: 0 }),
  'wheel':        one('alloy', 'Alloy', { color: 0xa8acb0, roughness: 0.3, metalness: 1 }),
};

export const ALL_ROLES = Object.keys(DEFAULT_REGISTRY) as Role[];

/**
 * Roles that exist only on the exterior body. The environment probe is captured from inside
 * the cabin, so these must be held out of it: wrapping the cabin in an opaque body otherwise
 * replaces the daylight arriving through the glazing with bounce off warm bodywork.
 */
export const EXTERIOR_ROLES: readonly Role[] = ['body.paint', 'body.graphic', 'tyre', 'wheel'];

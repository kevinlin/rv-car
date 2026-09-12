export type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass'
  | 'graphic.print' | 'graphic.screen'
  | 'body.paint' | 'body.graphic' | 'body.trim' | 'body.chrome'
  | 'body.led' | 'body.screen' | 'glass.tint' | 'tyre' | 'wheel';

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
  readonly roughnessMap?: TextureSpec;
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

const trim = one('black', 'Matt black', { color: 0x1e1e1e, roughness: 0.4, metalness: 0.8 });
const chrome = one('chrome', 'Chrome', { color: 0xffffff, roughness: 0.05, metalness: 1 });
const led = {
  active: 'warm',
  variants: [
    { id: 'warm',    label: 'Warm white',    params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffd9a0, emissiveIntensity: 3.5 } },
    { id: 'neutral', label: 'Neutral white', params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xfff3e0, emissiveIntensity: 3.5 } },
  ],
};
const screen = one('systems', 'Systems panel', {
  color: 0xffffff, roughness: 0.2, metalness: 0,
  emissive: 0x3a6ea8, emissiveIntensity: 2.2,
  map: { url: '/textures/systems-panel.webp' },
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
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.6754, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.8255, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.9006,  metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2.6, 2.6], srgb: false } } },
    ],
  },
  'wood.trim': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.5253, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.6754, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.7505,  metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2.6, 2.6], srgb: false } } },
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
      { id: 'walnut', label: 'Walnut',    params: { color: 0x6b4a2f, roughness: 0.1801, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xb98d5a, roughness: 0.2401, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2, 2], srgb: false } } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xe2cfae, roughness: 0.3002, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] },
        roughnessMap: { url: '/textures/walnut_r.webp', repeat: [2.6, 2.6], srgb: false } } },
    ],
  },
  // Photographs sample #808182 in shadow; the albedo is lighter than the pixel.
  'upholstery.seat':   one('grey', 'Grey leather', { color: 0xc9cac9, roughness: 0.9004, metalness: 0,
    map: { url: '/textures/leather-grey.webp', repeat: [4, 4] },
        roughnessMap: { url: '/textures/leather-grey_r.webp', repeat: [4, 4], srgb: false } }),
  'upholstery.bolster':one('camel', 'Camel leather', { color: 0xb08052, roughness: 0.9006, metalness: 0,
    map: { url: '/textures/leather-camel.webp', repeat: [4, 4] },
        roughnessMap: { url: '/textures/leather-camel_r.webp', repeat: [4, 4], srgb: false } }),
  'upholstery.sofa':   one('white-cream', 'White cream leather', { color: 0xf2ede4, roughness: 0.9004, metalness: 0,
    map: { url: '/textures/leather-cream.webp', repeat: [3, 3] },
        roughnessMap: { url: '/textures/leather-cream_r.webp', repeat: [3, 3], srgb: false } }),
  'worktop':           one('grey-stone', 'Grey stone', { color: 0xc9c6be, roughness: 0.9004, metalness: 0,
    map: { url: '/textures/stone.webp', repeat: [1.5, 1.5] },
        roughnessMap: { url: '/textures/stone_r.webp', repeat: [1.5, 1.5], srgb: false } }),
  // Sampled from the reference aisle shot at #8f9094 — a cool neutral, not the warm grey
  // the first palette pass estimated by eye.
  'floor':             one('grey-vinyl', 'Grey vinyl', { color: 0x8f9094, roughness: 0.8996, metalness: 0,
    map: { url: '/textures/herringbone.webp', repeat: [4, 4] },
        roughnessMap: { url: '/textures/herringbone_r.webp', repeat: [4, 4], srgb: false } }),
  'washroom.shell':    one('gloss-white', 'Gloss white GRP', { color: 0xf7f7f5, roughness: 0.8689, metalness: 0,
    map: { url: '/textures/grp-ribbed.webp', repeat: [2, 2] },
        roughnessMap: { url: '/textures/grp-ribbed_r.webp', repeat: [2, 2], srgb: false } }),
  'washroom.duckboard':one('teak', 'Teak', { color: 0x9a6b3c, roughness: 0.6, metalness: 0 }),
  'metal.brushed':     one('aluminium', 'Brushed aluminium', { color: 0xb8bcc0, roughness: 0.35, metalness: 1 }),
  'metal.chrome':      structuredClone(chrome),
  'metal.dark':        structuredClone(trim),
  'textile.curtain':   one('sand', 'Sand', { color: 0xd9cfbe, roughness: 0.95, metalness: 0,
    map: { url: '/textures/damask.webp', repeat: [6, 6] },
        normalMap: { url: '/textures/damask_n.webp', repeat: [6, 6], srgb: false } }),
  // 3.5, not the 14 the first pass used: at 14 the cove strips and downlights clipped to
  // white and streaked across the wall. The strips still read as lit; the RectAreaLights
  // in lighting.ts do the illuminating either way.
  'led.cove': structuredClone(led),
  // Flat graphics: framed art and the photo wall carry their image, the systems panel and TV
  // glow. Both keep color white so the photographic map is not tinted a second time.
  'graphic.print':  one('photo-wall', 'Photo wall', {
    color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true,
    map: { url: '/textures/photo-wall.webp' },
  }),
  'graphic.screen': structuredClone(screen),
  // Emissive rather than transparent: the world outside is not modelled, so the panes are lit
  // to read as blown-out daylight openings the way the reference shots do.
  'glass':             one('clear', 'Clear', { color: 0xdfe6ea, roughness: 0.05, metalness: 0, emissive: 0xeef4ff, emissiveIntensity: 1.4 }),

  'body.trim': structuredClone(trim),
  'body.chrome': structuredClone(chrome),
  'body.led': structuredClone(led),
  'body.screen': structuredClone(screen),
  'glass.tint': one('tinted', 'Tinted glass', { color: 0x18252b, roughness: 0.05, metalness: 0 }),
  'body.paint':   one('white-grp', 'White GRP', { color: 0xf2f3f2, roughness: 0.35, metalness: 0 }),
  // One copy across the flank, not a tile: the artwork carries a wordmark, and a wordmark
  // cannot be cut. box_uv gives the decal plane a UV spanning 3.9 x 1.75 at 1.0 UV/m, which is
  // what the rest of the pipeline holds every unwrap to, and this repeat divides it back to a
  // single copy. The UV survives the dispatch loop because model_interior.KEEPS_OWN_UV exempts
  // it; without that exemption smart_project would supply an origin and span nobody knows.
  'body.graphic': one('livery', 'Livery', {
    color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true,
    map: { url: '/textures/side-livery.webp', repeat: [1 / 3.9, 1 / 1.75] },
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
export const EXTERIOR_ROLES: readonly Role[] = [
  'body.paint', 'body.graphic', 'body.trim', 'body.chrome', 'body.led', 'body.screen',
  'glass.tint', 'tyre', 'wheel',
];

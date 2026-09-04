import { mm, type Mm } from './units';

export type ZoneId =
  | 'shell' | 'cab' | 'alcove' | 'dinette' | 'sofa' | 'storage' | 'galley' | 'washroom';

export type VolumeId = 'habitation' | 'slideout' | 'alcove' | 'cab';

/** Axis-aligned box in millimetres, in the frame defined by the plan's Global Constraints. */
export interface Box {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

const overallLength = mm(5998, 'published', 'C1 blue-plate limit is 6 m');
const overallWidth = mm(2450, 'published');
const overallHeight = mm(3200, 'published');
const wheelbase = mm(3300, 'published');
const frontAxleFromNose = mm(1050, 'estimated', 'Iveco Daily single cab');
const cabDepth = mm(1948, 'estimated', 'nose to bulkhead; set so habLength lands on 4050');
const wallThickness = mm(45, 'estimated', 'XPS sandwich wall');

export const ENVELOPE: Record<string, Mm> = {
  overallLength,
  overallWidth,
  overallHeight,
  wheelbase,
  frontAxleFromNose,
  cabDepth,
  wallThickness,
  rearAxleFromNose: mm(frontAxleFromNose.v + wheelbase.v, 'derived'),
  habLength: mm(overallLength.v - cabDepth.v, 'derived'),
  habWidth: mm(overallWidth.v - 2 * wallThickness.v, 'derived'),
  habHeight: mm(2000, 'estimated', 'SHAKIEST NUMBER IN THE MODEL — the phase 1 gate exists to catch this'),
  floorAboveGround: mm(1050, 'estimated', 'chassis frame plus double floor'),
  slideTravel: mm(580, 'derived', '1280 bed width minus ~700 sofa base'),
};

const HAB_HALF_W = ENVELOPE.habWidth!.v / 2;   // 1180
const HAB_L = ENVELOPE.habLength!.v;           // 4048
const HAB_H = ENVELOPE.habHeight!.v;           // 2000
const SLIDE = ENVELOPE.slideTravel!.v;         // 580

export const VOLUMES: Record<VolumeId, Box> = {
  habitation: { min: [-HAB_HALF_W, 0, 0], max: [HAB_HALF_W, HAB_H, HAB_L] },
  // Spans from the deployed slide wall all the way to the kerb wall: the slide-out bed
  // crosses the nominal habitation boundary, so a narrower volume would reject it.
  slideout: { min: [-HAB_HALF_W - SLIDE, 0, 150], max: [HAB_HALF_W, HAB_H, 2050] },
  alcove: { min: [-HAB_HALF_W, 1100, -1500], max: [HAB_HALF_W, HAB_H + 50, 100] },
  cab: { min: [-HAB_HALF_W, 0, -1950], max: [HAB_HALF_W, 1400, 100] },
};

export const ZONE_VOLUME: Record<Exclude<ZoneId, 'shell'>, VolumeId> = {
  cab: 'cab',
  alcove: 'alcove',
  dinette: 'habitation',
  sofa: 'slideout',
  storage: 'habitation',
  galley: 'habitation',
  washroom: 'habitation',
};

export interface Placement {
  readonly id: string;
  readonly zone: ZoneId;
  /** Minimum corner, millimetres. */
  readonly origin: readonly [Mm, Mm, Mm];
  /** Positive extents along +X, +Y, +Z, millimetres. */
  readonly size: readonly [Mm, Mm, Mm];
  readonly movable: boolean;
}

const e = (v: number) => mm(v, 'estimated');
const d = (v: number) => mm(v, 'derived');
const pub = (v: number) => mm(v, 'published');

const W = 30; // wall / panel thickness for shell boxes

export const PLACEMENTS: readonly Placement[] = [
  // --- shell (the enclosure; excluded from overlap and containment checks) ---
  { id: 'floor',    zone: 'shell', origin: [d(-1180), d(-W), d(0)],    size: [d(2360), d(W), d(4050)], movable: false },
  { id: 'ceiling',  zone: 'shell', origin: [d(-1180), d(2000), d(0)],  size: [d(2360), d(W), d(4050)], movable: false },
  { id: 'wall_off', zone: 'shell', origin: [d(-1180), d(0), d(0)],     size: [d(W), d(2000), d(4050)], movable: false },
  { id: 'wall_kerb',zone: 'shell', origin: [d(1150), d(0), d(0)],      size: [d(W), d(2000), d(4050)], movable: false },
  { id: 'bulkhead', zone: 'shell', origin: [d(-1180), d(0), d(-W)],    size: [d(2360), d(2000), d(W)], movable: false },
  { id: 'wall_rear',zone: 'shell', origin: [d(-1180), d(0), d(4050)],  size: [d(2360), d(2000), d(W)], movable: false },
  { id: 'slideout_shell', zone: 'shell', origin: [d(-1760), d(0), d(150)], size: [d(580), d(2000), d(1900)], movable: false },

  // --- cab ---
  { id: 'cab_seat_off',  zone: 'cab', origin: [e(-900), e(0), e(-1600)], size: [e(550), e(1100), e(550)], movable: false },
  { id: 'cab_seat_kerb', zone: 'cab', origin: [e(350), e(0), e(-1600)],  size: [e(550), e(1100), e(550)], movable: false },

  // --- alcove: transverse bed, 2200 across x 1400 fore-aft (published) ---
  { id: 'alcove_bed',     zone: 'alcove', origin: [d(-1100), e(1150), e(-1400)], size: [pub(2200), e(200), pub(1400)], movable: false },
  { id: 'alcove_lockers', zone: 'alcove', origin: [e(-1100), e(1500), e(-300)],  size: [e(2200), e(400), e(300)],      movable: false },

  // --- dinette: four captain chairs face to face around a pedestal table ---
  { id: 'dinette_chair_fwd_in',  zone: 'dinette', origin: [e(70), e(0), e(100)],  size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_fwd_out', zone: 'dinette', origin: [e(630), e(0), e(100)], size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_in',  zone: 'dinette', origin: [e(70), e(0), e(1360)], size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_out', zone: 'dinette', origin: [e(630), e(0), e(1360)],size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_table',         zone: 'dinette', origin: [e(120), e(0), e(640)], size: [e(980), e(720), e(700)],  movable: true },
  { id: 'lockers_kerb',          zone: 'dinette', origin: [e(700), e(1400), e(100)], size: [e(450), e(450), e(1900)], movable: false },

  // --- side slide-out: bench base plus the 1280 x 1900 bed (published) ---
  { id: 'slideout_base', zone: 'sofa', origin: [d(-1730), e(0), e(150)],   size: [d(1280), e(400), d(1900)], movable: false },
  { id: 'slideout_bed',  zone: 'sofa', origin: [d(-1730), e(400), e(150)], size: [pub(1280), e(200), pub(1900)], movable: false },
  { id: 'lockers_off',   zone: 'sofa', origin: [e(-1730), e(1400), e(150)],size: [e(450), e(450), e(1900)], movable: false },

  // --- storage band between lounge and wet zone ---
  { id: 'fridge',   zone: 'storage', origin: [e(-1150), e(0), e(2100)], size: [e(600), e(1800), e(400)], movable: false },
  { id: 'wardrobe', zone: 'storage', origin: [e(600), e(0), e(2100)],   size: [e(550), e(1900), e(400)], movable: false },

  // --- rear wet zone. Which side is which is open question 5 in the spec. ---
  { id: 'galley_run',      zone: 'galley', origin: [e(550), e(0), e(2550)],    size: [e(600), e(900), e(1500)], movable: false },
  { id: 'galley_overhead', zone: 'galley', origin: [e(550), e(1350), e(2550)], size: [e(600), e(450), e(1500)], movable: false },
  { id: 'washroom_pod',    zone: 'washroom', origin: [e(-1150), e(0), e(2650)],size: [e(700), e(1950), e(1400)], movable: false },
];

export const aabb = (p: Placement) => ({
  min: [p.origin[0].v, p.origin[1].v, p.origin[2].v] as [number, number, number],
  max: [
    p.origin[0].v + p.size[0].v,
    p.origin[1].v + p.size[1].v,
    p.origin[2].v + p.size[2].v,
  ] as [number, number, number],
});

export interface Hotspot {
  readonly id: ZoneId;
  readonly label: string;
  /** Metres, in the runtime frame. */
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  /** Radians for angles, metres for distance. */
  readonly orbit: {
    readonly azimuth: readonly [number, number];
    readonly polar: readonly [number, number];
    readonly distance: readonly [number, number];
  };
}

const D = Math.PI / 180;

export const HOTSPOTS: readonly Hotspot[] = [
  {
    id: 'dinette',
    label: 'Lounge',
    camera: { position: [-0.2, 1.35, 2.9], target: [0.55, 0.85, 0.9] },
    orbit: { azimuth: [-70 * D, 70 * D], polar: [60 * D, 105 * D], distance: [1.2, 3.4] },
  },
  {
    id: 'alcove',
    label: 'Alcove bed',
    camera: { position: [0.0, 1.5, 1.5], target: [0.0, 1.35, -0.7] },
    orbit: { azimuth: [-45 * D, 45 * D], polar: [65 * D, 100 * D], distance: [1.0, 2.6] },
  },
  {
    id: 'sofa',
    label: 'Slide-out bed',
    camera: { position: [0.35, 1.3, 2.4], target: [-1.05, 0.6, 1.1] },
    orbit: { azimuth: [-120 * D, 20 * D], polar: [60 * D, 105 * D], distance: [1.0, 2.8] },
  },
  {
    id: 'galley',
    label: 'Galley',
    camera: { position: [0.1, 1.45, 2.2], target: [0.85, 1.0, 3.3] },
    orbit: { azimuth: [-30 * D, 90 * D], polar: [60 * D, 100 * D], distance: [0.9, 2.4] },
  },
  {
    id: 'washroom',
    label: 'Washroom',
    camera: { position: [-0.3, 1.45, 2.2], target: [-0.85, 1.0, 3.1] },
    orbit: { azimuth: [-90 * D, 30 * D], polar: [60 * D, 100 * D], distance: [0.8, 2.0] },
  },
  {
    id: 'cab',
    label: 'Cab',
    camera: { position: [0.0, 1.4, 0.9], target: [0.0, 1.0, -1.3] },
    orbit: { azimuth: [-50 * D, 50 * D], polar: [65 * D, 100 * D], distance: [1.0, 2.6] },
  },
];

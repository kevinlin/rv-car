import { mm, type Mm } from './units';

export type ZoneId =
  | 'shell' | 'cab' | 'alcove' | 'dinette' | 'sofa' | 'storage' | 'galley' | 'washroom'
  | 'exterior';

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
  // Spans from the off wall all the way out to the deployed slide wall: the slide-out bed
  // crosses the nominal habitation boundary, so a narrower volume would reject it.
  slideout: { min: [-HAB_HALF_W, 0, 150], max: [HAB_HALF_W + SLIDE, HAB_H, 2050] },
  alcove: { min: [-HAB_HALF_W, 1100, -1500], max: [HAB_HALF_W, HAB_H + 50, 100] },
  cab: { min: [-HAB_HALF_W, 0, -1950], max: [HAB_HALF_W, 1400, 100] },
};

export const ZONE_VOLUME: Record<Exclude<ZoneId, 'shell' | 'exterior'>, VolumeId> = {
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
  // The sliding partition, and the defining feature of the 尾部独立厨卫区 layout: the rear
  // service room is only "independent" if something actually closes it off. Shell rather than
  // furniture, for the same reason the entry door is — it is a wall with a doorway in it, and
  // an enclosure cannot be held to the overlap and aisle rules it exists to divide.
  { id: 'partition', zone: 'shell', origin: [e(-1180), d(0), e(2500)], size: [d(2360), d(2000), e(50)], movable: false },
  { id: 'slideout_shell', zone: 'shell', origin: [d(1180), d(0), d(150)], size: [d(580), d(2000), d(1900)], movable: false },

  // --- cab ---
  { id: 'cab_seat_off',  zone: 'cab', origin: [e(-900), e(0), e(-1600)], size: [e(550), e(1100), e(550)], movable: false },
  { id: 'cab_seat_kerb', zone: 'cab', origin: [e(350), e(0), e(-1600)],  size: [e(550), e(1100), e(550)], movable: false },

  // --- alcove: transverse bed, 2200 across x 1400 fore-aft (published) ---
  { id: 'alcove_bed',     zone: 'alcove', origin: [d(-1100), e(1150), e(-1400)], size: [pub(2200), e(200), pub(1400)], movable: false },
  // Head-end lockers: the former -300 mm position blocked the sleeping-area entrance.
  { id: 'alcove_lockers', zone: 'alcove', origin: [e(-1100), e(1500), e(-1400)], size: [e(2200), e(400), e(300)],      movable: false },

  // --- lounge: a 1 + 2 booth (卡座) against the off wall, table between the facing seats ---
  // Still three seats — the published 5-seat occupancy leaves exactly three back here — but
  // 对面摆, 前一后二: the single forward seat faces aft across the table at the pair behind
  // it. The one row of three the previous pass read out of 中部3人汽车座椅 had the count
  // right and the arrangement wrong. The forward seat is centred on the pair.
  // `_off` / `_kerb` name the pair's own two positions, off-most first.
  { id: 'dinette_chair_fwd',      zone: 'dinette', origin: [e(-890), e(0), e(130)],  size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_off',  zone: 'dinette', origin: [e(-1150), e(0), e(1410)], size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_kerb', zone: 'dinette', origin: [e(-630), e(0), e(1410)], size: [e(520), e(1150), e(520)], movable: true },
  // 可收纳: the table stows. Modelled deployed only, on the same grounds as the slide-out.
  // 80 mm of knee gap to each facing seat, and its inboard edge sits outboard of the pair's,
  // so the seats rather than the table now set the aisle — which widens 520 → 560 mm.
  { id: 'dinette_table',          zone: 'dinette', origin: [e(-1080), e(0), e(730)], size: [e(900), e(720), e(600)],  movable: true },
  { id: 'lockers_off',           zone: 'dinette', origin: [e(-1150), e(1400), e(100)], size: [e(450), e(450), e(1900)], movable: false },

  // --- side slide-out: bench base plus the 1280 x 1900 bed (published) ---
  { id: 'slideout_base', zone: 'sofa', origin: [d(450), e(0), e(150)],   size: [d(1280), e(400), d(1900)], movable: false },
  { id: 'slideout_bed',  zone: 'sofa', origin: [d(450), e(400), e(150)], size: [pub(1280), e(200), pub(1900)], movable: false },
  { id: 'lockers_kerb',  zone: 'sofa', origin: [e(1280), e(1400), e(150)],size: [e(450), e(450), e(1900)], movable: false },

  // --- storage. The wardrobe is the only thing left in the band forward of the partition;
  // the 148 L fridge column stands in the SERVICE room, aft of the sliding door and hard up
  // against the washroom pod on the off flank. It is not part of the lounge and does not start
  // a line the galley continues — the galley faces it from the opposite flank.
  { id: 'fridge',   zone: 'storage', origin: [e(-1150), e(0), e(2550)], size: [e(600), e(1800), e(500)], movable: false },
  // 250 mm deep, which is the storage band the design spec states (Z 2050-2300); at 400 it
  // also filled the floor in front of the entry door.
  { id: 'wardrobe', zone: 'storage', origin: [e(600), e(0), e(2100)],   size: [e(550), e(1900), e(250)], movable: false },

  // --- rear wet zone. The galley is a 1200 mm run along the KERB flank and the washroom a
  // corner pod in the REAR OFF corner, so the service room's flanks are the opposite way round
  // to the lounge's: the galley faces the fridge and the washroom pod across the aisle rather
  // than continuing their line. The walkthrough video is explicit — from the lounge looking aft
  // through the partition, the counter and its pegboard are on the left and the mirrored
  // washroom door on the right — and the chain of inference that had the galley continue the
  // fridge's line was wrong twice over: wrong about the flank, and wrong about the fridge being
  // in the lounge at all. The boarding door is 后上门, in the rear wall, offset off the centreline to clear
  // the pod. Enter, and the counter is on your right, the washroom door on your left, with
  // 800 mm of aisle between them. Pinned by a test in check.test.ts, because reading handedness
  // off stills has now got it wrong four times.
  { id: 'galley_run',      zone: 'galley', origin: [e(550), e(0), e(2550)],    size: [e(600), e(900), e(1200)], movable: false },
  { id: 'galley_overhead', zone: 'galley', origin: [e(550), e(1350), e(2550)], size: [e(600), e(450), e(1200)], movable: false },
  { id: 'washroom_pod',    zone: 'washroom', origin: [e(-1150), e(0), e(3050)],  size: [e(900), e(1950), e(1000)], movable: false },

  // --- exterior. Every value derives from ENVELOPE, so the published envelope becomes
  // verifiable geometry. Excluded from overlap and containment checks: the body encloses
  // everything by design, exactly as the shell does.
  // Three new estimates and no more: a 400 mm double floor below the habitation floor, a
  // 1350 mm cab roof line, and a 372 mm wheel radius from a 225/75R16 on the Daily 4.5 t.
  // Sizes computed from those are tagged derived, matching how habLength already derives
  // from an estimated cabDepth. Nothing here touches a published dimension.
  { id: 'body_cab',         zone: 'exterior', origin: [e(-1100), e(-400),  d(-1948)], size: [e(2200), d(1750), d(1948)], movable: false },
  { id: 'body_alcove',      zone: 'exterior', origin: [d(-1225), e(1350),  d(-1948)], size: [d(2450), d(800),  d(1948)], movable: false },
  { id: 'body_habitation',  zone: 'exterior', origin: [d(-1225), e(-400),  d(0)],     size: [d(2450), d(2550), d(4050)], movable: false },
  { id: 'skirt',            zone: 'exterior', origin: [d(-1225), e(-700),  d(0)],     size: [d(2450), d(300),  d(4050)], movable: false },
  // 2000 mm tall, matching slideout_shell exactly. At the old estimated 1300 the exterior box
  // stopped 700 mm short of the interior shell it is supposed to enclose, and the kerb
  // three-quarter looked straight through the gap into the cabin.
  { id: 'slideout_box',     zone: 'exterior', origin: [d(1225),  e(0),     e(150)],   size: [d(580),  d(2000), e(1900)], movable: false },
  { id: 'wheel_front_off',  zone: 'exterior', origin: [e(-988),  d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_front_kerb', zone: 'exterior', origin: [e(763),   d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_off',   zone: 'exterior', origin: [e(-988),  d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_kerb',  zone: 'exterior', origin: [e(763),   d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
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
  /** Metres, in the runtime frame. In look mode `target` sets the initial heading. */
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  /**
   * Look rotates the camera about a fixed eye; orbit swings it around a target. Interior stops
   * are always look: orbiting inside a 2.36 m cabin at any useful radius leaves the vehicle.
   */
  readonly view:
    | { readonly kind: 'look'; readonly pitch: readonly [number, number] }
    | {
        readonly kind: 'orbit';
        readonly azimuth: readonly [number, number];
        readonly polar: readonly [number, number];
        readonly distance: readonly [number, number];
      };
}

const D = Math.PI / 180;

export const HOTSPOTS: readonly Hotspot[] = [
  // Positions retuned against the modelled geometry: the grey-box values sat too close, and two
  // of them sat inside furniture that did not exist when they were chosen.
  //
  // Every interior stop looks rather than orbits. The polar ranges these replaced were measured
  // from straight up: 50-100 deg and 70-100 deg, which as signed pitch from the horizon is
  // +40 to -10 and +20 to -10. Rounded outward to give the viewer somewhere to go.
  {
    id: 'dinette',
    // Forward of the partition at Z 2500, in the clear band between the booth and the wardrobe.
    // The old Z 2.6 stop now stood in the service room looking through a doorway.
    label: 'Lounge',
    camera: { position: [0.15, 1.55, 2.3], target: [-0.15, 0.95, 0.3] },
    view: { kind: 'look', pitch: [-35 * D, 35 * D] },
  },
  {
    id: 'alcove',
    label: 'Alcove bed',
    camera: { position: [0.0, 1.55, 1.9], target: [0.0, 1.3, -0.9] },
    view: { kind: 'look', pitch: [-35 * D, 35 * D] },
  },
  {
    id: 'sofa',
    label: 'Slide-out bed',
    camera: { position: [-0.35, 1.55, 2.02], target: [1.0, 0.55, 0.9] },
    view: { kind: 'look', pitch: [-45 * D, 30 * D] },
  },
  {
    id: 'galley',
    // Just aft of the partition, in the aisle at the forward end of the run, looking down its
    // length. The counter is on the kerb flank, so this is the classic galley shot: worktop
    // receding on one side, overheads above it, window over the counter.
    label: 'Galley',
    camera: { position: [-0.45, 1.6, 2.65], target: [0.85, 1.2, 3.3] },
    view: { kind: 'look', pitch: [-40 * D, 30 * D] },
  },
  {
    id: 'washroom',
    // In the aisle inboard of the pod, looking into its opening. The pod sits in the rear off
    // corner, so this stop crossed the cabin with it.
    label: 'Washroom',
    camera: { position: [0.3, 1.6, 2.95], target: [-0.7, 1.1, 3.65] },
    view: { kind: 'look', pitch: [-40 * D, 30 * D] },
  },
  {
    // Below the alcove bed, which starts at 1150 mm: any higher and the camera is in the mattress.
    id: 'cab',
    label: 'Cab',
    camera: { position: [0.0, 1.05, -0.05], target: [0.0, 0.8, -1.75] },
    view: { kind: 'look', pitch: [-30 * D, 30 * D] },
  },
  {
    // Three-quarter front, kerb side. Not the flat flank — the slide-out deploys to this one —
    // but the flank with everything on it: the awning and its strip, the storage bay, the
    // washer porthole, the control panel and the galley window, which is the walkaround the
    // video actually films. The off flank is flatter and carries only the livery band. Since
    // the vehicle is modelled deployed, the box is part of the subject rather than something
    // to hide from. Full azimuth is unlimited, so the orbit reaches the off flank too. Target
    // sits at the body's mid-height so the vehicle fills the frame without tipping.
    id: 'exterior',
    label: 'Exterior',
    camera: { position: [6.9, 1.9, -4.6], target: [0.0, 0.4, 1.2] },
    view: {
      kind: 'orbit',
      azimuth: [-Math.PI, Math.PI],
      polar: [55 * D, 88 * D],
      distance: [6.0, 14.0],
    },
  },
];

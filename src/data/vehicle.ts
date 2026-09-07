import { mm, toM, toMTriple, type Confidence, type Mm } from './units';

export type ZoneId =
  | 'shell' | 'cab' | 'alcove' | 'dinette' | 'sofa' | 'storage' | 'galley' | 'washroom'
  | 'exterior';

/**
 * A camera stop is not a zone. ZoneId means "a zone furniture belongs to" — it feeds
 * ZONE_VOLUME, Placement.zone and the containment check — and the plan stop owns no furniture.
 */
export type StopId = ZoneId | 'plan';

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
  // The boarding door, in the KERB flank forward of the rear corner. Shell rather than
  // furniture for the same reason the partition is: it is an opening in a wall, and as a
  // furniture placement it overlapped whatever run passed it. Being data rather than a literal
  // in build_shell is what lets check.ts end the aisle sampling here, and the 390 mm of flank
  // left aft of it is where the walkaround puts the grab rail, the keypad and the vent.
  // 90 mm deep rather than the wall's 45: the box has to hold the leaf, its frame and the
  // gathered flyscreen behind it, and check_models.mjs holds every named node to its own box.
  { id: 'entry_door', zone: 'shell', origin: [e(1105), d(0), e(2960)], size: [e(90), e(1850), e(700)], movable: false },

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

  // --- storage. The wardrobe is the only thing left in the band forward of the partition. The
  // 148 L fridge column stands in the SERVICE room, at the off end of the rear run, beside the
  // worktop rather than in the lounge.
  { id: 'fridge',   zone: 'storage', origin: [e(-1180), e(0), e(3500)], size: [e(600), e(1800), e(550)], movable: false },
  // 250 mm deep, which is the storage band the design spec states (Z 2050-2300); at 400 it
  // also filled the floor in front of the entry door.
  { id: 'wardrobe', zone: 'storage', origin: [e(600), e(0), e(2100)],   size: [e(550), e(1900), e(250)], movable: false },

  // --- rear service room, arranged ACROSS the vehicle about the boarding door rather than as
  // two runs down opposite flanks.
  //
  // 后上门 was read as a door in the rear wall. It is not: the walkaround opens it on the KERB
  // flank, forward of the rear corner, with the grab rail, keypad and vent on the stretch of
  // flank aft of it. So the entry faces inboard, and the room is organised about the path that
  // leads in from it — which is what the updated spatial brief's plan draws.
  //
  // Standing in that door looking in, your left hand is aft and your right hand is forward. So:
  //   left  — the worktop and basin, a run backing onto the REAR wall and crossing the
  //           centreline, with the fridge at its off end and the overheads above it;
  //   right — a tall shelf carrying the 3-in-1 combi oven, against the kerb flank forward of
  //           the door;
  //   ahead — the washroom pod, hard against the partition on the off flank.
  // The clear path between the oven shelf's aft face and the worktop's front face is 540 mm,
  // and the route on to the partition doorway passes between the pod and the shelf at 680 mm.
  //
  // The rear run crossing the centreline is why check.ts stops sampling the aisle at the door:
  // aft of the boarding door there is no through-corridor to protect, only a dead-end galley.
  { id: 'galley_run',      zone: 'galley', origin: [e(-580), e(0), e(3500)],    size: [e(1460), e(900), e(550)], movable: false },
  { id: 'galley_overhead', zone: 'galley', origin: [e(-580), e(1350), e(3500)], size: [e(1460), e(450), e(550)], movable: false },
  { id: 'galley_oven',     zone: 'galley', origin: [e(400), e(0), e(2550)],     size: [e(780), e(1900), e(410)], movable: false },
  { id: 'washroom_pod',    zone: 'washroom', origin: [e(-1180), e(0), e(2550)], size: [e(900), e(1950), e(940)], movable: false },

  // --- exterior. Every value derives from ENVELOPE, so the published envelope becomes
  // verifiable geometry. Excluded from overlap and containment checks: the body encloses
  // everything by design, exactly as the shell does.
  // Three new estimates and no more: a 400 mm double floor below the habitation floor, a
  // 1350 mm cab roof line, and a 372 mm wheel radius from a 225/75R16 on the Daily 4.5 t.
  // Sizes computed from those are tagged derived, matching how habLength already derives
  // from an estimated cabDepth. Nothing here touches a published dimension.
  // The three body masses OVERLAP their neighbours by 15 mm rather than butting flush.
  //
  // Flush, they met on two shared planes — all three at Z 0, and the cab's roof, the alcove's
  // underside and the alcove mattress's top all at Y 1350 — and coplanar faces z-fight. That is
  // what §14's "interior geometry shows through the cab/habitation step" has always been: not a
  // hole in the bodywork, which is why nothing was ever found to plug. The overlap is on the
  // junction faces only, so every envelope extreme is where it was: the nose stays at Z -1948,
  // the rear at 4050, the flanks at +-1225 and the alcove roof at 2150.
  { id: 'body_cab',         zone: 'exterior', origin: [e(-1100), e(-400),  d(-1948)], size: [e(2200), d(1750), d(1948)], movable: false },
  { id: 'body_alcove',      zone: 'exterior', origin: [d(-1225), e(1335),  d(-1948)], size: [d(2450), d(815),  d(1948)], movable: false },
  { id: 'body_habitation',  zone: 'exterior', origin: [d(-1225), e(-400),  d(-15)],   size: [d(2450), d(2550), d(4065)], movable: false },
  { id: 'skirt',            zone: 'exterior', origin: [d(-1225), e(-700),  d(0)],     size: [d(2450), d(300),  d(4050)], movable: false },
  // Encloses slideout_shell with 15 mm to spare on the roof and both ends, rather than matching
  // it exactly. At the old estimated 1300 the exterior box stopped 700 mm short of the shell it
  // is supposed to enclose and the kerb three-quarter looked straight into the cabin; the fix
  // for that made every one of those faces exactly coplanar with the shell's instead, which
  // z-fights. The committed exterior.webp shows it as a strip of cabinetry and a curtain down
  // the box's forward face. The clearance is on the three faces the exterior stop can see; the
  // underside stays on the floor plane, where the floor is what covers it.
  { id: 'slideout_box',     zone: 'exterior', origin: [d(1225),  e(0),     e(135)],   size: [d(580),  d(2015), e(1930)], movable: false },
  { id: 'wheel_front_off',  zone: 'exterior', origin: [e(-988),  d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_front_kerb', zone: 'exterior', origin: [e(763),   d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_off',   zone: 'exterior', origin: [e(-988),  d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_kerb',  zone: 'exterior', origin: [e(763),   d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
];

/**
 * The horizontal section height for the plan stop, in millimetres.
 *
 * Derived, not chosen. Both lounge locker runs have their underside at 1400 and the alcove
 * mattress tops out at 1350, so one plane at 1400 takes the ceiling, both cove fascias and
 * every locker run with it while leaving the beds whole. Move a locker run and the cut
 * follows it; placements.test.ts fails if the relationship breaks.
 */
const underside = (id: string) => PLACEMENTS.find((p) => p.id === id)!.origin[1].v;

export const PLAN_CUT_MM = Math.min(underside('lockers_off'), underside('lockers_kerb'));

/**
 * A label for the plan stop. Its dimensions are read off the placement it names, so a label
 * cannot claim a size the geometry does not have — the same discipline §2 of the design spec
 * applies to every number in this file, extended to the one place those numbers become copy a
 * viewer reads. Anything that is not a placement (an aisle width, a doorway) carries its own
 * anchor and detail string instead.
 */
export interface PlanLabel {
  readonly text: string;
  readonly placement?: string;
  readonly at?: readonly [Mm, Mm, Mm];
  readonly detail?: string;
}

const byId = (id: string) => PLACEMENTS.find((p) => p.id === id)!;

/** Label anchor in scene units: the placement's centre, or the explicit point. */
export const labelAnchorM = (l: PlanLabel): [number, number, number] => {
  if (l.at) return toMTriple(l.at);
  const p = byId(l.placement!);
  return [0, 1, 2].map((i) => toM(p.origin[i]!) + toM(p.size[i]!) / 2) as [number, number, number];
};

/** "2200 × 1400 published" — the two largest plan dimensions, plus the weaker confidence tag. */
export const labelDetail = (l: PlanLabel): string => {
  if (l.detail) return l.detail;
  const p = byId(l.placement!);
  const plan = [p.size[0]!, p.size[2]!].sort((a, b) => b.v - a.v);
  const rank: Record<Confidence, number> = { published: 0, derived: 1, estimated: 2 };
  const weakest = [p.size[0]!, p.size[2]!].reduce((a, b) => (rank[b.c] > rank[a.c] ? b : a));
  return `${plan[0]!.v} × ${plan[1]!.v} ${weakest.c}`;
};

export const PLAN_LABELS: readonly PlanLabel[] = [
  { text: 'Alcove bed',    placement: 'alcove_bed' },
  { text: 'Slide-out bed', placement: 'slideout_bed' },
  { text: 'Dinette booth', placement: 'dinette_table' },
  { text: 'Wardrobe',      placement: 'wardrobe' },
  { text: 'Fridge 148 L',  placement: 'fridge' },
  { text: 'Galley',        placement: 'galley_run' },
  { text: 'Washroom',      placement: 'washroom_pod' },
  { text: 'Sliding partition', placement: 'partition' },
  // Not placements: an aisle is the gap between two of them. The door is a placement, but an
  // opening cut into wall_kerb rather than a piece of furniture, so it carries its own detail.
  { text: 'Aisle', at: [d(0), d(900), d(1000)], detail: '560 mm derived' },
  { text: 'Aisle', at: [d(0), d(900), d(3300)], detail: '800 mm derived' },
  { text: 'Rear side door', placement: 'entry_door', detail: '700 mm clear, kerb flank' },
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
  readonly id: StopId;
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
    // In the entry path, looking aft at the rear run: worktop and basin across the frame with
    // the overheads above it, the fridge closing the off end and the rear window behind. The
    // old stop looked along a flank run that no longer exists.
    label: 'Galley',
    camera: { position: [0.05, 1.6, 2.72], target: [0.05, 1.05, 4.0] },
    view: { kind: 'look', pitch: [-40 * D, 30 * D] },
  },
  {
    id: 'washroom',
    // In the entry path, looking forward-and-off into the pod's opening. The pod moved forward
    // to the partition when the rear strip became the galley run, and this stop moved with it.
    label: 'Washroom',
    camera: { position: [0.35, 1.6, 3.15], target: [-0.85, 1.05, 3.0] },
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
  {
    // The floorplan the manufacturer never published, shown rather than drawn. Above the roof
    // line at 2.15, on the centreline, targeted at the middle of the OVERALL body rather than
    // of the habitation box: the vehicle runs Z -1.948 to 4.05, so its centre is 1.05 and a
    // target at 2.0 pushed the cab and the alcove off the top of the frame. 8.4 m of standoff
    // is what a 50 deg vertical field needs to hold all 6 m with margin. Polar floor is 0.05
    // rather than 0 because OrbitControls degenerates at the pole; the 55 deg ceiling lets the
    // viewer tip toward a three-quarter dollhouse without dropping to eye level, where the
    // sectioned walls stop reading as a cut and start reading as broken geometry.
    //
    // The arrival pose sits ON that 0.05 polar floor rather than straight overhead, and for the
    // same reason. Directly above the target the view direction is parallel to the camera's up
    // vector, so which way the plan reads is decided by whatever pose the tween came from —
    // arriving from the galley put the nose at the bottom of the frame and arriving from the
    // lounge put it at the top. Leaning 0.42 m AFT of the target pins it, and pins it nose-up,
    // which is the way §2 of the spatial brief draws every floor plan.
    id: 'plan',
    label: 'Floorplan',
    camera: { position: [0.0, 8.79, 1.47], target: [0.0, 0.4, 1.05] },
    view: {
      kind: 'orbit',
      azimuth: [-Math.PI, Math.PI],
      polar: [0.05, 55 * D],
      distance: [5.0, 12.0],
    },
  },
];

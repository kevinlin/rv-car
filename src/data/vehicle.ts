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
const cabDepth = mm(1950, 'estimated', 'nose to bulkhead');
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

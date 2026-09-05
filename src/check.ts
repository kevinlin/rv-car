import { PLACEMENTS, VOLUMES, ZONE_VOLUME, aabb, type Box, type Placement, type ZoneId } from './data/vehicle';

export const MIN_AISLE_MM = 400;

export interface Violation {
  readonly rule: 'overlap' | 'containment' | 'aisle' | 'published';
  readonly detail: string;
}

/** Strict: boxes that merely touch do not overlap. */
export const boxesOverlap = (a: Box, b: Box): boolean =>
  a.min[0]! < b.max[0]! && b.min[0]! < a.max[0]! &&
  a.min[1]! < b.max[1]! && b.min[1]! < a.max[1]! &&
  a.min[2]! < b.max[2]! && b.min[2]! < a.max[2]!;

export const boxContains = (outer: Box, inner: Box): boolean =>
  inner.min[0]! >= outer.min[0]! && inner.max[0]! <= outer.max[0]! &&
  inner.min[1]! >= outer.min[1]! && inner.max[1]! <= outer.max[1]! &&
  inner.min[2]! >= outer.min[2]! && inner.max[2]! <= outer.max[2]!;

/** Zones the integrity checks skip: both enclose the furniture rather than sit beside it. */
export const ENCLOSURES = new Set<ZoneId>(['shell', 'exterior']);
type FurnitureZone = Exclude<ZoneId, 'shell' | 'exterior'>;

const furniture = (ps: readonly Placement[]) => ps.filter((p) => !ENCLOSURES.has(p.zone));

const volumeOf = (zone: ZoneId) => VOLUMES[ZONE_VOLUME[zone as FurnitureZone]];

/** The walkable run: Z = 0 is the bulkhead plane, so sampling starts just inside it. */
const AISLE_Z_FROM = 50;
const AISLE_Z_TO = 4050;
const AISLE_Z_STEP = 50;

/**
 * Narrowest gap along X between anything on the off side and anything on the kerb side,
 * sampled every 50 mm down the habitation length. Sampling beats analytic interval merging
 * here: it is a few lines, and 50 mm is well under any clearance worth caring about.
 *
 * A box that straddles the centreline blocks the aisle outright and returns 0 — without that
 * case it would land in neither bucket and be silently ignored, which is precisely the
 * geometry the check exists to catch.
 */
export const minAisleWidth = (ps: readonly Placement[]): number => {
  const boxes = furniture(ps).map(aabb);
  let narrowest = Infinity;

  for (let z = AISLE_Z_FROM; z <= AISLE_Z_TO; z += AISLE_Z_STEP) {
    let offMax = -Infinity;
    let kerbMin = Infinity;

    for (const b of boxes) {
      if (z < b.min[2] || z > b.max[2]) continue;
      if (b.max[0] <= 0) offMax = Math.max(offMax, b.max[0]);
      else if (b.min[0] >= 0) kerbMin = Math.min(kerbMin, b.min[0]);
      else return 0; // straddles the centreline: no aisle at all
    }

    if (offMax === -Infinity || kerbMin === Infinity) continue;
    narrowest = Math.min(narrowest, kerbMin - offMax);
  }

  return narrowest === Infinity ? Infinity : narrowest;
};

export const checkAll = (ps: readonly Placement[] = PLACEMENTS): Violation[] => {
  const out: Violation[] = [];
  const items = furniture(ps);

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (boxesOverlap(aabb(a), aabb(b))) {
        out.push({ rule: 'overlap', detail: `${a.id} overlaps ${b.id}` });
      }
    }
  }

  for (const p of items) {
    if (!boxContains(volumeOf(p.zone), aabb(p))) {
      out.push({
        rule: 'containment',
        detail: `${p.id} leaves its ${ZONE_VOLUME[p.zone as FurnitureZone]} volume`,
      });
    }
  }

  const aisle = minAisleWidth(ps);
  if (aisle < MIN_AISLE_MM) {
    out.push({ rule: 'aisle', detail: `aisle is ${aisle} mm, minimum is ${MIN_AISLE_MM} mm` });
  }

  const beds: Array<[string, number, number]> = [
    ['alcove_bed', 2200, 1400],
    ['slideout_bed', 1280, 1900],
  ];
  for (const [id, x, z] of beds) {
    const p = ps.find((q) => q.id === id);
    if (!p) { out.push({ rule: 'published', detail: `missing ${id}` }); continue; }
    if (p.size[0].v !== x || p.size[2].v !== z) {
      out.push({ rule: 'published', detail: `${id} must stay ${x} x ${z} mm` });
    }
  }

  return out;
};

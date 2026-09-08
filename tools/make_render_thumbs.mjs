/**
 * Home-page imagery, cropped from the frames tools/capture_stops.mjs renders.
 *
 * Those frames arrive at a fixed 1600 x 1000 with the tour's own chrome hidden, so unlike the
 * hand-captured set this replaced there is no .ui bar to drop and no per-image aspect to guess:
 * every crop below is a fraction of that one known frame. Run pnpm capture first.
 */
import sharp from 'sharp';

const src = 'dist/captures';
const out = 'public/renders';
// Capture filenames, which are not hotspot ids — capture_stops.mjs owns that map.
const STOPS = ['lounge', 'alcove', 'slideout', 'galley', 'washroom', 'cab', 'exterior', 'plan'];

/**
 * Two stops read badly as a wide thumbnail if the whole frame is kept: the plan is a portrait
 * shape adrift in grey, and the body sits small in the middle of the exterior orbit. Both get a
 * crop that fills the card instead — for the plan, the band carrying the dimension labels, since
 * the labels are the point of that stop.
 */
const CROPS = {
  // Re-derived against the 2880 x 1800 capture: the old fractions were cut for the hand-captured
  // frames and, at this framing, landed inside the cabin with the labels sliced off both edges.
  plan: { left: 0.35, top: 0.33, width: 0.37, height: 0.40 },
  exterior: { left: 0.246, top: 0.228, width: 0.579, height: 0.537 },
};

/** A fractional crop resolved against one image's own pixel dimensions. */
const box = (id, width, height) => {
  const c = CROPS[id];
  if (!c) return { left: 0, top: 0, width, height };
  return {
    left: Math.round(c.left * width),
    top: Math.round(c.top * height),
    width: Math.round(c.width * width),
    height: Math.round(c.height * height),
  };
};

for (const id of STOPS) {
  const { width, height } = await sharp(`${src}/${id}.png`).metadata();
  await sharp(`${src}/${id}.png`)
    .extract(box(id, width, height))
    .resize({ width: 800 })
    .webp({ quality: 78 })
    .toFile(`${out}/${id}.webp`);
}

// The hero wants the body filling the frame; the exterior capture sits in a lot of empty backdrop.
const hero = await sharp(`${src}/exterior.png`).metadata();
await sharp(`${src}/exterior.png`)
  .extract({
    left: Math.round(0.246 * hero.width), top: Math.round(0.175 * hero.height),
    width: Math.round(0.579 * hero.width), height: Math.round(0.627 * hero.height),
  })
  .resize({ width: 1600 })
  .webp({ quality: 82 })
  .toFile(`${out}/hero.webp`);

console.log(`Wrote ${STOPS.length + 1} images to ${out}/`);

/**
 * Home-page imagery, derived from the comparison set in docs/research/final.
 *
 * Those captures have the tour's own .ui bar burnt into the bottom of the frame, so every crop
 * here drops that band; a thumbnail that shows the buttons reads as a screenshot of the app
 * rather than as a view of the vehicle. Re-run after recapturing the final set.
 */
import sharp from 'sharp';

const src = 'docs/research/final';
const out = 'public/renders';
// Height of the .ui bar as a fraction of the frame — the captures are not all the same size,
// so a pixel count only holds for the one it was measured on.
const UI_BAR = 0.073;
const STOPS = ['lounge', 'alcove', 'slideout', 'galley', 'washroom', 'cab', 'exterior', 'plan'];

/**
 * Two stops read badly as a wide thumbnail if the whole frame is kept: the plan is a portrait
 * shape adrift in grey, and the body sits small in the middle of the exterior orbit. Both get a
 * crop that fills the card instead — for the plan, the band carrying the dimension labels, since
 * the labels are the point of that stop.
 */
const CROPS = {
  plan: { left: 0.38, top: 0.448, width: 0.295, height: 0.24 },
  exterior: { left: 0.246, top: 0.228, width: 0.579, height: 0.537 },
};

/** A fractional crop resolved against one image's own pixel dimensions. */
const box = (id, width, height) => {
  const c = CROPS[id];
  if (!c) return { left: 0, top: 0, width, height: Math.round(height * (1 - UI_BAR)) };
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

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
const UI_BAR = 130; // height of the .ui bar in a 1882-tall capture
const STOPS = ['lounge', 'alcove', 'slideout', 'galley', 'washroom', 'cab', 'exterior', 'plan'];

/**
 * Two stops read badly as a wide thumbnail if the whole frame is kept: the plan is a portrait
 * shape adrift in grey, and the body sits small in the middle of the exterior orbit. Both get a
 * crop that fills the card instead — for the plan, the band carrying the dimension labels, since
 * the labels are the point of that stop.
 */
const CROPS = {
  plan: { left: 1349, top: 830, width: 935, height: 485 },
  exterior: { left: 850, top: 430, width: 2000, height: 1010 },
};

for (const id of STOPS) {
  const { width, height } = await sharp(`${src}/${id}.png`).metadata();
  await sharp(`${src}/${id}.png`)
    .extract(CROPS[id] ?? { left: 0, top: 0, width, height: height - UI_BAR })
    .resize({ width: 800 })
    .webp({ quality: 78 })
    .toFile(`${out}/${id}.webp`);
}

// The hero wants the body filling the frame; the exterior capture sits in a lot of empty backdrop.
await sharp(`${src}/exterior.png`)
  .extract({ left: 850, top: 330, width: 2000, height: 1180 })
  .resize({ width: 1600 })
  .webp({ quality: 82 })
  .toFile(`${out}/hero.webp`);

console.log(`Wrote ${STOPS.length + 1} images to ${out}/`);

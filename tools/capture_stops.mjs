/**
 * Re-capture the overview page's source frames from the running tour.
 *
 * Replaces the hand-captured docs/research/final/, deleted in a771cf4, which pnpm thumbs still
 * reads. Output goes to dist/captures — gitignored, because only the cropped public/renders/*.webp
 * are committed. Run this, then pnpm thumbs.
 *
 * Two traps this has to step around, both of which produce a plausible-looking wrong image:
 *
 *  - loadModules uses allSettled and continues on failure, so the page renders the grey-box
 *    fallback rather than erroring. Wait for all ten modules, and fail loudly if any is missing.
 *  - Texture loading is async and separate from module loading. main.ts's ?verify loop publishes
 *    textureState and a texturedFrames counter; wait for a run of textured frames, not one.
 *
 * ?verify is also what exposes the draw-call and fps readout, so the run doubles as the
 * per-stop performance measurement the plan's verification step 8 asks for.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const OUT = 'dist/captures';
// Deliberately 16:10 and a round number: the thumbnail crops in make_render_thumbs.mjs are
// fractions of the frame, so they only mean anything against a fixed capture aspect. The width
// is what it is because the hero crop takes 0.579 of it and then resizes to 1600 — anything
// smaller upscales. deviceScaleFactor stays 1: doubling it quadruples the software-rendered
// framebuffer for pixels no thumbnail uses.
const VIEWPORT = { width: 2880, height: 1800 };

/**
 * Capture filename -> hotspot id. These are NOT the same strings: the overview page's imagery
 * is named for the zone a reader would call it, and two of the ids differ. Using one as the
 * other silently captures the wrong stop.
 */
const STOPS = {
  lounge: 'dinette',
  alcove: 'alcove',
  slideout: 'sofa',
  galley: 'galley',
  washroom: 'washroom',
  cab: 'cab',
  exterior: 'exterior',
  plan: 'plan',
};

/** The tour's own chrome. In a thumbnail it reads as a screenshot of the app, not the vehicle. */
const HIDE_UI = '.ui, .ui-home { display: none !important; }';

// detached, so kill() below can take down the whole group: killing the pnpm shim alone leaves
// vite holding the port, and the next run then silently talks to a stale server.
const server = spawn('pnpm', ['dev'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true });
/** Read the origin out of vite's banner rather than assuming 5173 — it walks the port if taken. */
const ready = new Promise((resolve, reject) => {
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', (chunk) => {
    const url = /http:\/\/localhost:\d+/.exec(chunk);
    if (url) resolve(url[0]);
  });
  server.on('exit', (code) => reject(new Error(`vite exited with ${code}`)));
  setTimeout(() => reject(new Error('vite did not start within 30s')), 30_000);
});

try {
  const origin = await ready;
  console.log(`dev server at ${origin}`);
  await mkdir(OUT, { recursive: true });
  // channel 'chromium' is the full browser rather than the headless shell: on macOS it reaches
  // the GPU through ANGLE/Metal, where the shell falls back to SwiftShader and spends minutes
  // per stop rasterising a 2880 x 1800 frame in software.
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('  page error:', m.text()); });
  const measured = {};

  for (const [file, stop] of Object.entries(STOPS)) {
    // The `stop` query param is inert — it is there to make each URL differ. main.ts reads
    // location.hash exactly once at startup and installs no hashchange listener, so navigating
    // between two hashes of the same document never re-resolves the stop, and every capture
    // after the first would silently be the lounge again.
    await page.goto(`${origin}/tour.html?verify&stop=${file}#${stop}`, { waitUntil: 'load' });
    await page.addStyleTag({ content: HIDE_UI });

    // Ten modules bound, and enough consecutive textured frames that nothing is still resolving.
    await page.waitForFunction(() => {
      const d = document.querySelector('canvas')?.dataset;
      // texturedFrames only counts up while textureState is 'ready', so a run of them is proof
      // the resolver has drained, not just that one frame happened to land between loads.
      return d?.loadedModules?.split(',').length === 10 && Number(d.texturedFrames) > 10;
    }, null, { timeout: 60_000 });

    const d = await page.evaluate(() => ({ ...document.querySelector('canvas').dataset }));
    if (d.missingModules) throw new Error(`${stop}: missing modules ${d.missingModules}`);
    if (d.textureErrors) throw new Error(`${stop}: texture errors ${d.textureErrors}`);

    // Draw calls and triangles are what the renderer submitted, so they are exact. fps is not
    // the spec's figure — headless has no vsync and the framebuffer is 2880 x 1800, not 1080p —
    // so it is read opportunistically and never waited on past a few seconds. main.ts publishes
    // it once per 120 frames, so a slow stop simply records null rather than stalling the run.
    const fps = await page.waitForFunction(() => document.querySelector('canvas')?.dataset.fps,
      null, { timeout: 8_000 }).then((h) => h.jsonValue(), () => null);
    measured[file] = { stop, drawCalls: +d.drawCalls, triangles: +d.triangles, fpsHeadless: fps && +fps };

    await page.screenshot({ path: `${OUT}/${file}.png` });
    console.log(`${file.padEnd(9)} <- #${stop.padEnd(9)} ${d.drawCalls} draws, ${d.triangles} tris, ${fps ?? '?'} fps`);
  }

  await writeFile(`${OUT}/measured.json`, `${JSON.stringify(measured, null, 2)}\n`);
  await browser.close();
  console.log(`\nWrote ${Object.keys(STOPS).length} captures and measured.json to ${OUT}/`);
} finally {
  try { process.kill(-server.pid); } catch { server.kill(); }
}

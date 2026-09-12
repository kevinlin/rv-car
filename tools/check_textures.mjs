import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEFAULT_REGISTRY } from '../src/data/finishes.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TOLERANCE = 0.01; // Absolute roughness product tolerance.
// Pre-map registry constants recorded on 2026-09-12. Never derive these from the live registry.
// Shape: { [role]: { [variantId]: target } }. Missing targets fail when a variant gains a map.
export const ROUGHNESS_TARGETS = {
  'wood.cabinet': { 'walnut': 0.45, 'oak': 0.55, 'ash': 0.6 },
  'wood.trim': { 'walnut': 0.35, 'oak': 0.45, 'ash': 0.5 },
  'panel.wall': { 'bone': 0.8 },
  'panel.locker': { 'walnut': 0.12, 'oak': 0.16, 'ash': 0.2 },
  'upholstery.seat': { 'grey': 0.7 },
  'upholstery.bolster': { 'camel': 0.7 },
  'upholstery.sofa': { 'white-cream': 0.7 },
  'worktop': { 'grey-stone': 0.35 },
  'floor': { 'grey-vinyl': 0.75 },
  'washroom.shell': { 'gloss-white': 0.15 },
  'washroom.duckboard': { 'teak': 0.6 },
  'metal.brushed': { 'aluminium': 0.35 },
  'metal.chrome': { 'chrome': 0.05 },
  'metal.dark': { 'black': 0.4 },
  'textile.curtain': { 'sand': 0.95 },
  'led.cove': { 'warm': 1, 'neutral': 1 },
  'graphic.print': { 'photo-wall': 0.9 },
  'graphic.screen': { 'systems': 0.2 },
  'glass': { 'clear': 0.05 },
  'body.trim': { 'black': 0.4 },
  'body.chrome': { 'chrome': 0.05 },
  'body.led': { 'warm': 1, 'neutral': 1 },
  'body.screen': { 'systems': 0.2 },
  'glass.tint': { 'tinted': 0.05 },
  'body.paint': { 'white-grp': 0.35 },
  'body.graphic': { 'livery': 0.4 },
  'tyre': { 'rubber': 0.9 },
  'wheel': { 'alloy': 0.3 },
};

export function checkRoughness(constant, mean, range, target) {
  const errors = [];
  if (!Number.isFinite(constant) || constant < 0 || constant > 1) {
    errors.push('roughness constant must lie in [0, 1]; re-window the map, never clamp the constant');
  }
  if (!Number.isFinite(mean) || mean < 0 || mean > 1) errors.push('decoded meanGreen must lie in [0, 1]');
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)
    || range.min < 0 || range.max > 1 || range.min > range.max) {
    errors.push('manifest must specify 0 <= roughness.min <= roughness.max <= 1');
  } else if (mean < range.min || mean > range.max) {
    errors.push(`decoded mean ${mean} is outside manifest range [${range.min}, ${range.max}]`);
  }
  if (!Number.isFinite(target) || target < 0 || target > 1) errors.push('missing or invalid recorded target');
  else if (Number.isFinite(constant) && Number.isFinite(mean) && Math.abs(constant * mean - target) > TOLERANCE) {
    errors.push(`roughness * mean = ${constant * mean}, target ${target} ± ${TOLERANCE}`);
  }
  return errors;
}

export async function readMean(mapPath, entry, metadataDir) {
  const mapStat = await stat(mapPath);
  // CLI measurements live in model/; standalone rectifications put them beside the map.
  const sidecars = [...new Set([resolve(metadataDir, `${entry.out}_r.json`), mapPath.replace(/\.webp$/, '.json')])];
  for (const path of sidecars) {
    try {
      const sidecarStat = await stat(path);
      const measurement = JSON.parse(await readFile(path, 'utf8'));
      if (sidecarStat.mtimeMs >= mapStat.mtimeMs && measurement?.out === entry.out
        && measurement.file === `${entry.out}_r.webp`
        && measurement.range?.min === entry.roughness?.min && measurement.range?.max === entry.roughness?.max
        && Number.isFinite(measurement.meanGreen) && measurement.meanGreen >= 0 && measurement.meanGreen <= 1) {
        return { mean: measurement.meanGreen, source: `sidecar: ${path}` };
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }
  const { data, info } = await sharp(await readFile(mapPath)).toColourspace('srgb').removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 1; i < data.length; i += info.channels) sum += data[i];
  return { mean: sum / (info.width * info.height) / 255, source: `decoded WebP: ${mapPath}` };
}

export async function checkTextures(registry = DEFAULT_REGISTRY,
  manifest, root = ROOT, targets = ROUGHNESS_TARGETS) {
  manifest ??= JSON.parse(await readFile(resolve(root, 'model/textures.json'), 'utf8'));
  const rows = [], violations = [];
  for (const [role, { variants }] of Object.entries(registry)) {
    for (const { id, params } of variants) {
      if (!params.roughnessMap) continue;
      const target = targets[role]?.[id];
      const row = { role, variant: id, constant: params.roughness, mean: null, product: null, target, source: 'unavailable' };
      rows.push(row);
      const errors = [];
      try {
        const entry = manifest.textures.find((e) => params.roughnessMap.url === `/textures/${e.out}_r.webp`);
        if (!entry) throw new Error(`no manifest entry for ${params.roughnessMap.url}`);
        const measured = await readMean(resolve(root, `public${params.roughnessMap.url}`), entry, resolve(root, 'model'));
        row.mean = measured.mean;
        row.source = measured.source;
        row.product = params.roughness * measured.mean;
        errors.push(...checkRoughness(params.roughness, measured.mean, entry.roughness, target));
      } catch (error) { errors.push(error.message); }
      violations.push(...errors.map((error) => `${role}/${id}: ${error}`));
    }
  }
  return { rows, violations };
}

export function printReport({ rows, violations }) {
  if (rows.length) console.table(rows);
  else console.log('No roughness maps in DEFAULT_REGISTRY; 0 mapped variants checked.');
  if (violations.length) console.error(`Texture violations:\n${violations.map((v) => `  - ${v}`).join('\n')}`);
  else if (rows.length) console.log(`Checked ${rows.length} mapped variants; no texture violations.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const report = await checkTextures();
    printReport(report);
    if (report.violations.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Texture check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

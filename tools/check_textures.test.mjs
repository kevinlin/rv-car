import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkRoughness, readMean, checkTextures, printReport } from './check_textures.mjs';

test('roughness product, range, target and constant checks reject the multiplier trap', () => {
  const range = { min: 0.3, max: 0.6 };
  assert.deepEqual(checkRoughness(0.7, 0.5, range, 0.35), []);
  assert.deepEqual(checkRoughness(0.7, 0.5, range, 0.359), []);
  assert.match(checkRoughness(0.7, 0.5, range, 0.361).join(), /target/);
  assert.match(checkRoughness(1.1875, 0.8, { min: 0.7, max: 0.9 }, 0.95).join(), /re-window.*never clamp/);
  for (const constant of [-0.1, NaN, Infinity]) {
    assert.match(checkRoughness(constant, 0.5, range, 0.35).join(), /constant/);
  }
  for (const mean of [-1, 2, NaN, Infinity]) {
    assert.match(checkRoughness(0.7, mean, range, 0.35).join(), /meanGreen/);
  }
  assert.match(checkRoughness(0.7, 0.7, range, 0.49).join(), /outside manifest range/);
  for (const target of [undefined, NaN, -1, 2]) {
    assert.match(checkRoughness(0.7, 0.5, range, target).join(), /recorded target/);
  }
  for (const invalid of [undefined, {}, { min: 0.6, max: 0.3 }, { min: -1, max: 2 }]) {
    assert.match(checkRoughness(0.7, 0.5, invalid, 0.35).join(), /manifest/);
  }
});

const fixture = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'rv-texture-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const metadataDir = join(root, 'model');
  await mkdir(metadataDir);
  await mkdir(join(root, 'public/textures'), { recursive: true });
  const mapPath = join(root, 'public/textures/test_r.webp');
  // Different R/B values detect accidentally averaging RGB instead of G.
  await sharp(Buffer.from([20, 102, 230, 50, 153, 210]), { raw: { width: 2, height: 1, channels: 3 } })
    .webp({ lossless: true }).toFile(mapPath);
  const entry = { out: 'test', roughness: { min: 0.3, max: 0.6 } };
  const sidecar = { out: 'test', file: 'test_r.webp', range: entry.roughness, meanGreen: 0.5 };
  return { root, metadataDir, mapPath, entry, sidecar };
};

test('prefers valid sidecars, falls back to decoded green for missing, stale or malformed sidecars', async (t) => {
  const { metadataDir, mapPath, entry, sidecar } = await fixture(t);
  const measured = await readMean(mapPath, entry, metadataDir);
  assert.equal(measured.mean, 0.5);
  assert.match(measured.source, /decoded WebP/);
  const path = join(metadataDir, 'test_r.json');
  await writeFile(path, JSON.stringify(sidecar));
  assert.match((await readMean(mapPath, entry, metadataDir)).source, /sidecar:/);
  await utimes(path, new Date(0), new Date(0));
  assert.match((await readMean(mapPath, entry, metadataDir)).source, /decoded WebP/);
  for (const content of ['{', 'null', JSON.stringify({ ...sidecar, meanGreen: 2 }),
    JSON.stringify({ ...sidecar, file: 'wrong.webp' }), JSON.stringify({ ...sidecar, range: {} })]) {
    await writeFile(path, content);
    assert.deepEqual(await readMean(mapPath, entry, metadataDir), measured);
  }
  await rm(path);
  await writeFile(mapPath.replace('.webp', '.json'), JSON.stringify(sidecar));
  assert.match((await readMean(mapPath, entry, metadataDir)).source, /sidecar:/);
  await rm(mapPath);
  await assert.rejects(readMean(mapPath, entry, metadataDir), { code: 'ENOENT' });
});

test('checks every mapped variant including inactive variants and reports failures by role/id', async (t) => {
  const { root, entry } = await fixture(t);
  const variant = (id, roughness) => ({ id, params: { roughness, roughnessMap: { url: '/textures/test_r.webp' } } });
  const registry = { wood: { active: 'a', variants: [variant('a', 0.7), variant('b', 0.8), { id: 'plain', params: {} }] } };
  const targets = { wood: { a: 0.35, b: 0.4 } };
  const run = () => checkTextures(registry, { textures: [entry] }, root, targets);
  const report = await run();
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.violations, []);
  assert.equal(report.rows[1].product, 0.4);
  registry.wood.variants[1].params.roughness = 1.2;
  assert.match((await run()).violations.join(), /wood\/b:.*re-window/);
  delete targets.wood.a;
  assert.match((await run()).violations.join(), /wood\/a:.*recorded target/);
  registry.wood.variants[0].params.roughnessMap.url = '/textures/missing_r.webp';
  assert.match((await run()).violations.join(), /wood\/a:.*no manifest entry/);
});

test('an unmapped registry reports explicitly that nothing was checked', async (t) => {
  const report = await checkTextures({ wood: { variants: [{ id: 'plain', params: {} }] } }, { textures: [] });
  assert.deepEqual(report, { rows: [], violations: [] });
  const messages = [];
  t.mock.method(console, 'log', (message) => messages.push(message));
  t.mock.method(console, 'table', () => assert.fail('must not print an empty table'));
  printReport(report);
  assert.deepEqual(messages, ['No roughness maps in DEFAULT_REGISTRY; 0 mapped variants checked.']);
});

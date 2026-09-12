import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, type MaterialParams } from './data/finishes';

const publicDir = realpathSync('public');

function assertMaps(params: MaterialParams) {
  for (const spec of [params.map, params.normalMap, params.roughnessMap]) {
    if (!spec) continue;
    const file = realpathSync(resolve(publicDir, spec.url.replace(/^\//, '')));
    expect(file.startsWith(publicDir + sep)).toBe(true);
    expect(statSync(file).isFile()).toBe(true);
  }
  for (const spec of [params.normalMap, params.roughnessMap]) {
    if (!spec) continue;
    expect(spec.srgb).toBe(false);
    expect(params.map).toBeDefined();
    expect(spec.repeat).toEqual(params.map!.repeat);
  }
}

describe('PBR asset contracts', () => {
  it('resolves every registry map under public and keeps data maps linear and registered', () => {
    for (const slot of Object.values(DEFAULT_REGISTRY)) {
      for (const variant of slot.variants) assertMaps(variant.params);
    }
  });

  it.each(['normalMap', 'roughnessMap'] as const)('checks populated %s specs, including invalid ones', (channel) => {
    // Reuse an existing file: these assertions inspect specs, not authored map pixels.
    const map = { url: '/textures/walnut.webp', repeat: [2, 2] as const };
    const params = { color: 0xffffff, roughness: 0.5, metalness: 0, map };
    const data = { ...map, srgb: false };
    expect(() => assertMaps({ ...params, [channel]: data })).not.toThrow();
    for (const invalid of [
      { ...data, srgb: true },
      { ...data, srgb: undefined },
      { ...data, repeat: [3, 2] as const },
      { ...data, url: '/textures/does-not-exist.webp' },
      { ...data, url: '/../package.json' },
      { ...data, url: '/textures' },
    ]) {
      expect(() => assertMaps({ ...params, [channel]: invalid })).toThrow();
    }
  });

  it('keeps normal and metallic-roughness textures out of every committed GLB material', () => {
    const modules = readdirSync('public/models').filter((name) => name.endsWith('.glb'));
    expect(modules.length).toBeGreaterThan(0);
    for (const name of modules) {
      const glb = readFileSync(resolve('public/models', name));
      expect(glb.toString('ascii', 0, 4)).toBe('glTF');
      expect(glb.readUInt32LE(4)).toBe(2);
      expect(glb.readUInt32LE(16)).toBe(0x4e4f534a);
      const gltf = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as {
        materials: { normalTexture?: unknown; pbrMetallicRoughness?: { metallicRoughnessTexture?: unknown } }[];
      };
      expect(gltf.materials.length, name).toBeGreaterThan(0);
      for (const material of gltf.materials) {
        expect(material, name).not.toHaveProperty('normalTexture');
        expect(material.pbrMetallicRoughness ?? {}, name).not.toHaveProperty('metallicRoughnessTexture');
      }
    }
  });
});

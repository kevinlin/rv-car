import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { HOTSPOTS } from './data/vehicle';

/**
 * The overview page is static HTML, so its links into the walkthrough are the one place a stop
 * id is written by hand. main.ts resolves `tour.html#<id>` against HOTSPOTS and falls back to
 * the first stop silently, which is the right runtime behaviour and the wrong build behaviour:
 * rename a stop and every thumbnail would quietly land in the lounge instead.
 */
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html', () => {
  it('links only to stops that exist', () => {
    const linked = [...home.matchAll(/tour\.html#([\w-]+)/g)].map((m) => m[1]!);
    expect(linked.length).toBeGreaterThan(0);
    const ids = new Set<string>(HOTSPOTS.map((h) => h.id));
    expect(linked.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('references only images that exist', () => {
    const srcs = [...home.matchAll(/src="\.\/([^"]+)"/g)].map((m) => m[1]!);
    expect(srcs.length).toBeGreaterThan(0);
    const missing = srcs.filter((s) => !existsSync(new URL(`../public/${s}`, import.meta.url)));
    expect(missing).toEqual([]);
  });
});

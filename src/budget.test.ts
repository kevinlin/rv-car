import { describe, it, expect } from 'vitest';
import { MAX_TRIANGLES, MAX_BYTES, summarise } from '../tools/check_budget.mjs';

describe('budget thresholds', () => {
  it('matches the spec', () => {
    expect(MAX_TRIANGLES).toBe(350_000);
    expect(MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('summarise', () => {
  it('reports no violations when under budget', () => {
    expect(summarise(100_000, 5 * 1024 * 1024).violations).toEqual([]);
  });

  it('reports a violation when over the triangle budget', () => {
    expect(summarise(400_000, 1024).violations.some((v) => v.includes('triangle'))).toBe(true);
  });

  it('reports a violation when over the byte budget', () => {
    expect(summarise(1000, 30 * 1024 * 1024).violations.some((v) => v.includes('bytes'))).toBe(true);
  });
});

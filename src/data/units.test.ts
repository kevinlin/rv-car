import { describe, it, expect } from 'vitest';
import { mm, toM, toMTriple, type Mm } from './units';

describe('units', () => {
  it('carries a confidence tag', () => {
    const d: Mm = mm(2200, 'published', 'alcove bed length');
    expect(d.v).toBe(2200);
    expect(d.c).toBe('published');
    expect(d.note).toBe('alcove bed length');
  });

  it('converts millimetres to metres', () => {
    expect(toM(mm(2200, 'published'))).toBeCloseTo(2.2);
    expect(toM(mm(0, 'derived'))).toBe(0);
    expect(toM(mm(-1180, 'derived'))).toBeCloseTo(-1.18);
  });

  it('converts a triple in one call', () => {
    const t = toMTriple([mm(1000, 'derived'), mm(2000, 'derived'), mm(-500, 'derived')]);
    expect(t).toEqual([1, 2, -0.5]);
  });
});

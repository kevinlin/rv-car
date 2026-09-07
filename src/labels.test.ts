// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildLabels } from './labels';
import { PLAN_LABELS, labelAnchorM } from './data/vehicle';

describe('buildLabels', () => {
  it('creates one object per label, positioned at its anchor', () => {
    const g = buildLabels(PLAN_LABELS);
    expect(g.children).toHaveLength(PLAN_LABELS.length);
    const first = g.children[0]!;
    expect(first.position.toArray()).toEqual(labelAnchorM(PLAN_LABELS[0]!));
  });

  it('renders the label text and its derived detail line', () => {
    const g = buildLabels(PLAN_LABELS);
    const el = (g.children[0]! as unknown as { element: HTMLElement }).element;
    expect(el.textContent).toContain('Alcove bed');
    expect(el.textContent).toContain('2200 × 1400 published');
  });

  it('starts hidden, because the plan stop is not the landing view', () => {
    expect(buildLabels(PLAN_LABELS).visible).toBe(false);
  });
});

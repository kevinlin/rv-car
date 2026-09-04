/** How much we actually know about a dimension. See the spec's §2. */
export type Confidence =
  | 'published'  // stated by the manufacturer or a named review
  | 'derived'    // arithmetic on published values
  | 'estimated'; // read off photographs

export interface Mm {
  readonly v: number;
  readonly c: Confidence;
  readonly note?: string;
}

export const mm = (v: number, c: Confidence, note?: string): Mm => ({ v, c, note });

/** The only place in the codebase that converts millimetres to scene units. */
export const toM = (d: Mm): number => d.v / 1000;

export const toMTriple = (t: readonly [Mm, Mm, Mm]): [number, number, number] => [
  toM(t[0]), toM(t[1]), toM(t[2]),
];

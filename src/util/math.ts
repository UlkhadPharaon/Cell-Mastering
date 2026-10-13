/** Deterministic PRNG (mulberry32) so cell layouts are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Uniformly sample a point on the unit sphere. */
export function unitVector(rng: () => number): [number, number, number] {
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return [r * Math.cos(theta), u, r * Math.sin(theta)];
}

/** Poisson-ish spread: pick random directions, reject those too close to accepted ones. */
export function spreadPoints(
  rng: () => number,
  count: number,
  minAngle: number,
  maxTries = 30
): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  let guard = count * maxTries;
  while (out.length < count && guard-- > 0) {
    const v = unitVector(rng);
    let ok = true;
    for (const p of out) {
      const dot = p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
      if (dot > Math.cos(minAngle)) { ok = false; break; }
    }
    if (ok) out.push(v);
  }
  while (out.length < count) out.push(unitVector(rng)); // relaxed fallback
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

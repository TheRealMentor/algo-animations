/**
 * Deterministic PRNG (mulberry32) so a given seed always produces the same
 * input. Without this, comparing two algorithms in the Complexity Lab would be
 * comparing them on *different* inputs, and the curves would be noise.
 *
 * Shared across data structures — arrays and strings both need seeded
 * randomness, and the generator itself has nothing to do with either.
 */
export function makeRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

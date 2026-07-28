import type {
  AnyAlgorithmSpec,
  AnyDataStructure,
  Counters,
  GrowthModel,
} from './types'
import { arrayAccesses, tallyEvent, zeroCounters } from './types'

/**
 * The headless half of the playground: run algorithms at increasing n and count
 * what they actually do, with no visual state built at all.
 *
 * Structure-agnostic — it asks the `DataStructure` for inputs and tallies the
 * shared operation vocabulary, so a tree traversal profiles the same way a sort
 * does.
 *
 * Sizes double, which is what makes the growth table readable: when n doubles,
 * a linear algorithm's work doubles and a quadratic algorithm's quadruples.
 * Reading "≈4×" off a row is a more durable lesson than reading "O(n²)".
 */

export interface Measurement {
  n: number
  comparisons: number
  accesses: number
}

export interface ComplexitySeries {
  algorithmId: string
  points: Measurement[]
}

export type Metric = 'comparisons' | 'accesses'

export function sizeLadder(maxN: number, base = 32): number[] {
  const sizes: number[] = []
  for (let n = base; n <= maxN; n *= 2) sizes.push(n)
  return sizes
}

function countOnly(
  structure: AnyDataStructure,
  spec: AnyAlgorithmSpec,
  n: number,
  shapeId: string,
  seed: number,
  trial: number,
): Counters {
  const input = structure.makeInput({
    n,
    shapeId,
    seed,
    trial,
    requiresSortedInput: spec.requiresSortedInput,
  })

  const c = zeroCounters()
  for (const e of spec.run(input)) tallyEvent(c, e)
  return c
}

export function measure(
  structure: AnyDataStructure,
  spec: AnyAlgorithmSpec,
  n: number,
  shapeId: string,
  seed: number,
): Measurement {
  const trials = Math.max(1, spec.profileTrials)

  let comparisons = 0
  let accesses = 0
  for (let t = 0; t < trials; t++) {
    const c = countOnly(structure, spec, n, shapeId, seed, t)
    comparisons += c.comparisons
    accesses += arrayAccesses(c)
  }

  return { n, comparisons: comparisons / trials, accesses: accesses / trials }
}

/**
 * Sweeps every selected algorithm across the size ladder.
 *
 * Yields to the event loop between measurements: a quadratic sort at n = 4096
 * is ~8M comparisons through a generator, long enough to jank the UI if run in
 * one synchronous block. `onProgress` drives the progress bar.
 */
export async function runSweep(
  structure: AnyDataStructure,
  specs: AnyAlgorithmSpec[],
  maxN: number,
  shapeId: string,
  seed: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ComplexitySeries[]> {
  const sizes = sizeLadder(maxN)
  const total = specs.length * sizes.length
  let done = 0

  const out: ComplexitySeries[] = specs.map((s) => ({ algorithmId: s.id, points: [] }))

  for (let si = 0; si < specs.length; si++) {
    for (const n of sizes) {
      out[si].points.push(measure(structure, specs[si], n, shapeId, seed))
      done++
      onProgress?.(done, total)
      // Hand the frame back so the progress bar can paint.
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return out
}

export const GROWTH_FN: Record<GrowthModel, (n: number) => number> = {
  'log n': (n) => Math.log2(Math.max(2, n)),
  n: (n) => n,
  'n log n': (n) => n * Math.log2(Math.max(2, n)),
  'n²': (n) => n * n,
}

/**
 * Scales a theoretical curve to sit on top of the measured data.
 *
 * Big-O drops constant factors, so a raw n² curve is meaningless next to real
 * counts. Anchoring at the largest measured n turns the overlay into the
 * question that matters: does the measured data have the same *shape*?
 */
export function fitCurve(
  points: Measurement[],
  model: GrowthModel,
  metric: Metric,
): (n: number) => number {
  const f = GROWTH_FN[model]
  const anchor = points[points.length - 1]
  if (!anchor) return () => 0
  const measured = metric === 'comparisons' ? anchor.comparisons : anchor.accesses
  const c = measured / f(anchor.n)
  return (n) => c * f(n)
}

/** ops(2n) / ops(n) — the number the growth table is really about. */
export function growthRatios(points: Measurement[], metric: Metric): Array<number | null> {
  return points.map((p, i) => {
    if (i === 0) return null
    const prev = metric === 'comparisons' ? points[i - 1].comparisons : points[i - 1].accesses
    const cur = metric === 'comparisons' ? p.comparisons : p.accesses
    return prev > 0 ? cur / prev : null
  })
}

/**
 * Names the growth class a measured doubling ratio best matches.
 *
 * Fixed ratio bands do NOT work here. At the sizes this playground reaches, an
 * n log n algorithm doubles by 2·(log n + 1)/log n — which is 2.22 at n = 1024,
 * uncomfortably close to linear's exact 2.0. Any hand-picked cutoff between
 * them mislabels one or the other.
 *
 * So instead of banding, compute what each model's ratio actually *is* between
 * these two specific sizes and pick the nearest. Comparison is done in log
 * space so a factor-of-two error scores the same whichever side it falls on.
 */
export function classifyRatio(
  ratio: number | null,
  prevN?: number,
  n?: number,
): string {
  if (ratio === null || ratio <= 0) return '—'
  if (prevN === undefined || n === undefined || prevN <= 0) return '—'

  const models: GrowthModel[] = ['log n', 'n', 'n log n', 'n²']

  let best: GrowthModel = 'n'
  let bestErr = Infinity
  for (const m of models) {
    const expected = GROWTH_FN[m](n) / GROWTH_FN[m](prevN)
    const err = Math.abs(Math.log(ratio) - Math.log(expected))
    if (err < bestErr) {
      bestErr = err
      best = m
    }
  }

  // Nothing sensible to snap to — say so rather than guessing.
  if (bestErr > Math.log(1.5)) return ratio > 4 ? 'worse than n²' : 'unclear'

  return best === 'log n' ? '≈ log n' : `≈ ${best}`
}

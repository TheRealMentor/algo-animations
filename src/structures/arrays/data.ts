import type { InputShape } from '../../core/types'
import { makeRng } from '../../lib/rng'

/** Input shapes for arrays. The whole point of offering these is that
 *  best/average/worst case stop being abstract — you pick the shape and watch
 *  the cost change. Other structures declare their own list (strings offer
 *  repetitive/no-match/many-matches instead). */
export type Distribution = 'random' | 'sorted' | 'reversed' | 'nearly-sorted' | 'few-unique'

export const SHAPES: InputShape[] = [
  { id: 'random', label: 'Random', hint: 'The average case.' },
  { id: 'sorted', label: 'Sorted', hint: 'Best case for bubble sort, worst case for this quick sort.' },
  { id: 'reversed', label: 'Reversed', hint: 'Worst case for bubble sort.' },
  { id: 'nearly-sorted', label: 'Nearly sorted', hint: 'A few elements out of place.' },
  { id: 'few-unique', label: 'Few unique', hint: 'Lots of duplicate values.' },
]

export function generateArray(
  size: number,
  distribution: Distribution,
  seed: number,
): number[] {
  const rng = makeRng(seed)
  const maxValue = Math.max(size, 10)

  switch (distribution) {
    case 'sorted':
      return Array.from({ length: size }, (_, i) => i + 1)

    case 'reversed':
      return Array.from({ length: size }, (_, i) => size - i)

    case 'nearly-sorted': {
      const a = Array.from({ length: size }, (_, i) => i + 1)
      // Displace roughly 5% of elements, minimum one swap on a non-trivial array.
      const swaps = Math.max(size > 1 ? 1 : 0, Math.floor(size * 0.05))
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(rng() * size)
        const j = Math.min(size - 1, i + 1 + Math.floor(rng() * 3))
        const tmp = a[i]
        a[i] = a[j]
        a[j] = tmp
      }
      return a
    }

    case 'few-unique': {
      const buckets = Math.max(2, Math.floor(Math.sqrt(size)))
      return Array.from({ length: size }, () =>
        Math.ceil(((Math.floor(rng() * buckets) + 1) / buckets) * maxValue),
      )
    }

    case 'random':
    default:
      return Array.from({ length: size }, () => 1 + Math.floor(rng() * maxValue))
  }
}

/** Search algorithms need ordered input to be meaningful. */
export function generateSortedArray(size: number, seed: number): number[] {
  const rng = makeRng(seed)
  const out: number[] = []
  let v = 1 + Math.floor(rng() * 5)
  for (let i = 0; i < size; i++) {
    out.push(v)
    v += 1 + Math.floor(rng() * 4)
  }
  return out
}

/**
 * Pick a target for a search demo. `hitRate` is the probability of choosing a
 * value that is actually present — a miss is the true worst case, so it needs
 * to be reachable.
 */
export function pickTarget(sorted: number[], seed: number, hitRate = 0.75): number {
  if (sorted.length === 0) return 0
  const rng = makeRng(seed)
  if (rng() < hitRate) return sorted[Math.floor(rng() * sorted.length)]
  // A value guaranteed to fall between two entries, so the search misses.
  const i = Math.floor(rng() * sorted.length)
  return sorted[i] + (i + 1 < sorted.length && sorted[i + 1] > sorted[i] + 1 ? 1 : 0.5)
}

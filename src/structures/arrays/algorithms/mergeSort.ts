import type { AlgorithmSpec } from '../../../core/types'
import type { ArrayEvent, ArrayInput } from '../model'

/**
 * Top-down merge sort with a single reusable auxiliary buffer.
 *
 * Why the aux buffer is visualised as its own row: during a merge, the main
 * array is being overwritten from the left while the comparisons are happening
 * against the *copy*. If we highlighted comparison indices on the main row, the
 * highlighted bars would frequently be values that have already been
 * overwritten — the animation would be quietly lying. Emitting `region: 'aux'`
 * on those comparisons keeps the picture honest.
 */
function* merge(
  a: number[],
  aux: number[],
  lo: number,
  mid: number,
  hi: number,
): Generator<ArrayEvent> {
  yield { kind: 'range', lo, hi }
  yield { kind: 'note', text: `Merging [${lo}..${mid}] with [${mid + 1}..${hi}]` }

  // Copy the live region into the buffer, then merge back out of it.
  for (let k = lo; k <= hi; k++) {
    yield { kind: 'read', i: k }
    yield { kind: 'write', i: k, value: a[k], prev: aux[k], region: 'aux' }
    aux[k] = a[k]
  }

  let i = lo
  let j = mid + 1

  for (let k = lo; k <= hi; k++) {
    if (i > mid) {
      // Left half spent — drain the right.
      yield { kind: 'read', i: j, region: 'aux' }
      yield { kind: 'write', i: k, value: aux[j], prev: a[k] }
      a[k] = aux[j]
      j++
    } else if (j > hi) {
      // Right half spent — drain the left.
      yield { kind: 'read', i, region: 'aux' }
      yield { kind: 'write', i: k, value: aux[i], prev: a[k] }
      a[k] = aux[i]
      i++
    } else {
      yield { kind: 'compare', i, j, region: 'aux' }
      if (aux[j] < aux[i]) {
        yield { kind: 'write', i: k, value: aux[j], prev: a[k] }
        a[k] = aux[j]
        j++
      } else {
        // `<` above rather than `<=` here keeps the sort stable: on a tie the
        // left half wins, preserving original relative order.
        yield { kind: 'write', i: k, value: aux[i], prev: a[k] }
        a[k] = aux[i]
        i++
      }
    }
  }
}

function* sort(
  a: number[],
  aux: number[],
  lo: number,
  hi: number,
): Generator<ArrayEvent> {
  if (lo >= hi) return
  const mid = lo + ((hi - lo) >> 1)
  yield { kind: 'range', lo, hi }
  yield* sort(a, aux, lo, mid)
  yield* sort(a, aux, mid + 1, hi)
  yield* merge(a, aux, lo, mid, hi)
}

function* run({ array }: ArrayInput): Generator<ArrayEvent> {
  const a = array
  if (a.length === 0) return

  const aux = a.slice()
  yield { kind: 'auxInit', values: aux }
  yield* sort(a, aux, 0, a.length - 1)

  for (let i = 0; i < a.length; i++) yield { kind: 'sorted', i }
}

export const mergeSort: AlgorithmSpec<ArrayInput, ArrayEvent> = {
  id: 'merge-sort',
  name: 'Merge Sort',
  structureId: 'arrays',
  categoryId: 'sorting',
  blurb:
    'Splits the array in half all the way down to single elements, then merges the sorted halves back together pair by pair.',
  complexity: {
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(n)',
  },
  expectedGrowth: 'n log n',
  requiresSortedInput: false,
  profileTrials: 1,
  colorSlot: 2,
  run,
}

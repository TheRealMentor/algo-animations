import type { AlgorithmSpec } from '../../../core/types'
import type { ArrayEvent, ArrayInput } from '../model'

/**
 * Classic bubble sort with the early-exit optimisation: if a full pass makes no
 * swap, the array is already ordered and we stop. That optimisation is what
 * gives bubble sort its O(n) best case — without it, best and worst are both
 * O(n²), and the "Sorted" input preset in the Complexity Lab would look
 * identical to the "Random" one.
 */
function* run({ array }: ArrayInput): Generator<ArrayEvent> {
  const a = array
  const n = a.length
  if (n === 0) return

  for (let end = n - 1; end > 0; end--) {
    let swapped = false
    yield { kind: 'range', lo: 0, hi: end }

    for (let i = 0; i < end; i++) {
      yield { kind: 'compare', i, j: i + 1 }
      if (a[i] > a[i + 1]) {
        yield { kind: 'swap', i, j: i + 1 }
        const tmp = a[i]
        a[i] = a[i + 1]
        a[i + 1] = tmp
        swapped = true
      }
    }

    // The largest unsorted value has bubbled to `end` and is now final.
    yield { kind: 'sorted', i: end }

    if (!swapped) {
      yield { kind: 'note', text: 'A full pass with no swaps — already ordered, stopping early.' }
      for (let i = end - 1; i >= 0; i--) yield { kind: 'sorted', i }
      return
    }
  }

  yield { kind: 'sorted', i: 0 }
}

export const bubbleSort: AlgorithmSpec<ArrayInput, ArrayEvent> = {
  id: 'bubble-sort',
  name: 'Bubble Sort',
  structureId: 'arrays',
  categoryId: 'sorting',
  blurb:
    'Repeatedly walks the array, swapping any two neighbours that are out of order, so the largest remaining value bubbles to the end on every pass.',
  complexity: {
    best: 'O(n)',
    average: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
  },
  expectedGrowth: 'n²',
  requiresSortedInput: false,
  profileTrials: 1,
  colorSlot: 1,
  run,
}

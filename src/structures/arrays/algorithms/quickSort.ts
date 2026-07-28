import type { AlgorithmSpec } from '../../../core/types'
import type { ArrayEvent, ArrayInput } from '../model'

/**
 * Quick sort, Lomuto partition scheme, pivot = last element of the range.
 *
 * Two deliberate implementation choices:
 *
 * 1. An EXPLICIT STACK instead of recursion. Not stylistic — `yield*` delegation
 *    costs one stack frame per nesting level per event, so a recursive version
 *    degrades to O(depth) per event. On already-sorted input this scheme
 *    recurses n deep, which would make the Complexity Lab pathologically slow
 *    and eventually blow the call stack. The flat loop yields every event in
 *    O(1) regardless of depth.
 *
 * 2. A last-element pivot, kept on purpose even though median-of-three is
 *    better in practice. It makes the classic failure mode reachable: run the
 *    Complexity Lab with the "Sorted" or "Reversed" preset and quick sort
 *    visibly bends into an n² curve while merge sort does not. Swapping in a
 *    smarter pivot would hide the single most instructive thing about this
 *    algorithm.
 */
function* run({ array }: ArrayInput): Generator<ArrayEvent> {
  const a = array
  const n = a.length
  if (n === 0) return

  // Ranges still to be partitioned. Smaller side is pushed last so it is
  // popped first, which bounds the stack at O(log n) entries.
  const stack: Array<[number, number]> = [[0, n - 1]]

  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!
    if (lo >= hi) continue

    yield { kind: 'range', lo, hi }

    const pivotValue = a[hi]
    yield { kind: 'pivot', i: hi }
    yield { kind: 'note', text: `Partitioning [${lo}..${hi}] around ${pivotValue}` }

    // Everything left of `store` is < pivot.
    let store = lo
    for (let i = lo; i < hi; i++) {
      yield { kind: 'compare', i, j: hi }
      if (a[i] < pivotValue) {
        if (i !== store) {
          yield { kind: 'swap', i, j: store }
          const tmp = a[i]
          a[i] = a[store]
          a[store] = tmp
        }
        store++
      }
    }

    if (store !== hi) {
      yield { kind: 'swap', i: store, j: hi }
      const tmp = a[store]
      a[store] = a[hi]
      a[hi] = tmp
    }

    // The pivot has landed in its final position.
    yield { kind: 'sorted', i: store }

    const leftSize = store - lo
    const rightSize = hi - store

    if (leftSize > rightSize) {
      stack.push([lo, store - 1])
      stack.push([store + 1, hi])
    } else {
      stack.push([store + 1, hi])
      stack.push([lo, store - 1])
    }
  }

  for (let i = 0; i < n; i++) yield { kind: 'sorted', i }
}

export const quickSort: AlgorithmSpec<ArrayInput, ArrayEvent> = {
  id: 'quick-sort',
  name: 'Quick Sort',
  structureId: 'arrays',
  categoryId: 'sorting',
  blurb:
    'Picks a pivot, moves everything smaller to its left and everything larger to its right, then repeats on each side.',
  complexity: {
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n²)',
    space: 'O(log n)',
  },
  expectedGrowth: 'n log n',
  requiresSortedInput: false,
  profileTrials: 1,
  colorSlot: 3,
  run,
}

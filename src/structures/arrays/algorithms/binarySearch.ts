import type { AlgorithmSpec } from '../../../core/types'
import type { ArrayEvent, ArrayInput } from '../model'

/**
 * Iterative binary search over a sorted array.
 *
 * The playground guarantees sorted input for search algorithms (see
 * `requiresSortedInput`) — on unsorted input this returns a wrong answer rather
 * than an error, which is exactly the point worth teaching, but is not
 * something the UI should let you stumble into by accident.
 *
 * `lo + ((hi - lo) >> 1)` rather than `(lo + hi) / 2` avoids the overflow bug
 * that sat in the JDK for years. It cannot actually overflow at the array sizes
 * this playground reaches, but the habit is the lesson.
 */
function* run({ array, target }: ArrayInput): Generator<ArrayEvent> {
  const a = array
  if (a.length === 0) {
    yield { kind: 'exhausted' }
    return
  }

  const needle = target ?? a[Math.floor(a.length / 2)]

  let lo = 0
  let hi = a.length - 1

  yield { kind: 'note', text: `Searching for ${needle}` }

  while (lo <= hi) {
    yield { kind: 'range', lo, hi }

    const mid = lo + ((hi - lo) >> 1)
    yield { kind: 'probe', i: mid }
    yield { kind: 'compareTarget', i: mid }

    if (a[mid] === needle) {
      yield { kind: 'found', i: mid }
      yield { kind: 'note', text: `Found ${needle} at index ${mid}` }
      return
    }

    if (a[mid] < needle) {
      yield { kind: 'note', text: `${a[mid]} < ${needle} — discard the left half` }
      lo = mid + 1
    } else {
      yield { kind: 'note', text: `${a[mid]} > ${needle} — discard the right half` }
      hi = mid - 1
    }
  }

  yield { kind: 'exhausted' }
  yield { kind: 'note', text: `${needle} is not in the array` }
}

export const binarySearch: AlgorithmSpec<ArrayInput, ArrayEvent> = {
  id: 'binary-search',
  name: 'Binary Search',
  structureId: 'arrays',
  categoryId: 'searching',
  blurb:
    'Checks the middle of the remaining range and throws away the half that cannot contain the target, halving the problem every step.',
  complexity: {
    best: 'O(1)',
    average: 'O(log n)',
    worst: 'O(log n)',
    space: 'O(1)',
  },
  expectedGrowth: 'log n',
  requiresSortedInput: true,
  profileTrials: 240,
  colorSlot: 4,
  secondaryStat: { label: 'Array reads', value: (c) => c.reads },
  run,
}

import type { Category, DataStructure } from '../../core/types'
import type { ArrayEvent, ArrayInput, ArrayState } from './model'
import { applyArrayEvent, initialArrayState } from './model'
import { ArrayView, BarLegend } from './ArrayView'
import type { Distribution } from './data'
import { SHAPES, generateArray, generateSortedArray, pickTarget } from './data'
import { bubbleSort } from './algorithms/bubbleSort'
import { mergeSort } from './algorithms/mergeSort'
import { quickSort } from './algorithms/quickSort'
import { binarySearch } from './algorithms/binarySearch'

const categories: Category[] = [
  {
    id: 'sorting',
    name: 'Sorting',
    blurb: 'Put the elements in order. The classic place to see O(n²) and O(n log n) diverge.',
  },
  {
    id: 'searching',
    name: 'Searching',
    blurb: 'Find one element. Ordered input buys you a dramatically cheaper search.',
  },
]

export const arrays: DataStructure<ArrayState, ArrayEvent, ArrayInput> = {
  id: 'arrays',
  name: 'Arrays',
  blurb: 'A contiguous, index-addressable sequence — the structure sorting and searching live on.',

  categories,

  // Order here is display order, and fixes each algorithm's colour slot.
  algorithms: [bubbleSort, mergeSort, quickSort, binarySearch],

  shapes: SHAPES,

  // A legibility limit, not a performance one: past ~220 bars each is under 3px
  // wide and you cannot follow a swap. Large n belongs in the Complexity Lab.
  minN: 8,
  maxN: 220,
  defaultN: 48,

  makeInput({ n, shapeId, seed, trial, requiresSortedInput }): ArrayInput {
    if (requiresSortedInput) {
      const array = generateSortedArray(n, seed)
      // A different target per trial so profiling averages over the whole
      // array rather than measuring the same lookup 240 times.
      return { array, target: pickTarget(array, seed + trial * 7919) }
    }
    return { array: generateArray(n, shapeId as Distribution, seed + trial) }
  },

  cloneInput: (input) => ({ array: input.array.slice(), target: input.target }),

  initialState: initialArrayState,
  applyEvent: applyArrayEvent,

  View: ArrayView,
  Legend: BarLegend,

  describeInput: (input) =>
    input.target === undefined ? null : `Target: ${input.target}`,
}

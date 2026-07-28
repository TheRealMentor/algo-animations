import { describe, expect, it } from 'vitest'
import { arrays } from './index'
import { binarySearch } from './algorithms/binarySearch'
import type { ArrayEvent, ArrayInput } from './model'
import type { AlgorithmSpec } from '../../core/types'
import { buildTimeline, initialState, applyEvent, seek } from '../../core/player'
import { measure, growthRatios, classifyRatio } from '../../core/complexity'
import type { Distribution } from './data'
import { SHAPES, generateArray, generateSortedArray } from './data'
import { STRUCTURES, byCategory, algorithmById } from '../registry'

type Spec = AlgorithmSpec<ArrayInput, ArrayEvent>

const SORTS = arrays.algorithms.filter((a) => a.categoryId === 'sorting') as Spec[]
const SEARCHES = arrays.algorithms.filter((a) => a.categoryId === 'searching') as Spec[]

const SIZES = [0, 1, 2, 3, 7, 16, 33, 64, 100]

function runToCompletion(spec: Spec, array: number[], target?: number) {
  const working = array.slice()
  const events = Array.from(spec.run({ array: working, target }))
  return { array: working, events }
}

const isSorted = (a: number[]) => a.every((v, i) => i === 0 || a[i - 1] <= v)

const sameMultiset = (a: number[], b: number[]) => {
  const sa = a.slice().sort((x, y) => x - y)
  const sb = b.slice().sort((x, y) => x - y)
  return sa.length === sb.length && sa.every((v, i) => v === sb[i])
}

const timelineFor = (spec: Spec, array: number[], target?: number) =>
  buildTimeline(arrays, spec, { array, target })

describe.each(SORTS.map((s) => [s.name, s] as const))('%s', (_name, spec) => {
  it.each(SIZES)('sorts a random array of %i elements', (n) => {
    const input = generateArray(n, 'random', n + 1)
    const { array } = runToCompletion(spec, input)
    expect(isSorted(array)).toBe(true)
    expect(sameMultiset(array, input)).toBe(true)
  })

  it.each(SHAPES.map((s) => s.id))('sorts %s input', (shape) => {
    const input = generateArray(64, shape as Distribution, 7)
    const { array } = runToCompletion(spec, input)
    expect(isSorted(array)).toBe(true)
    expect(sameMultiset(array, input)).toBe(true)
  })

  it('handles an array where every value is identical', () => {
    const input = new Array(40).fill(5)
    const { array } = runToCompletion(spec, input)
    expect(array).toEqual(input)
  })

  it('marks every index as sorted by the end', () => {
    const timeline = timelineFor(spec, generateArray(32, 'random', 3))
    const final = seek(timeline, timeline.events.length)
    expect(final.sorted.every(Boolean)).toBe(true)
  })
})

describe('player replay', () => {
  /**
   * The load-bearing invariant of the whole design: the array the player
   * rebuilds from the event stream must match the array the algorithm actually
   * produced. If this breaks, the animation is showing something the algorithm
   * never did.
   */
  it.each(SORTS.map((s) => [s.name, s] as const))(
    '%s: replayed state matches real execution',
    (_name, spec) => {
      const input = generateArray(50, 'random', 99)
      const { array: truth } = runToCompletion(spec, input)
      const timeline = timelineFor(spec, input)
      const replayed = seek(timeline, timeline.events.length)
      expect(replayed.array).toEqual(truth)
    },
  )

  it('never mutates the caller-supplied input', () => {
    const input = generateArray(30, 'random', 42)
    const pristine = input.slice()
    const timeline = timelineFor(SORTS[0], input)
    seek(timeline, timeline.events.length)
    expect(input).toEqual(pristine)
  })

  it('reaches identical state whether stepping forward or seeking backward', () => {
    const timeline = timelineFor(SORTS[0], generateArray(24, 'random', 5))
    const mid = Math.floor(timeline.events.length / 2)

    const forward = seek(timeline, mid)
    const arrayForward = forward.array.slice()
    const countersForward = { ...forward.counters }

    // Overshoot to the end, then come back — forces the replay-from-zero path.
    seek(timeline, timeline.events.length, { state: forward, cursor: mid })
    const back = seek(timeline, mid)

    expect(back.array).toEqual(arrayForward)
    expect(back.counters).toEqual(countersForward)
  })

  it('counts the same totals whether replayed once or event by event', () => {
    const timeline = timelineFor(SORTS[1], generateArray(40, 'random', 11))
    const s = initialState(timeline)
    for (const e of timeline.events) applyEvent(timeline, s, e)
    expect(s.counters).toEqual(timeline.totalCounters)
  })
})

describe('binary search', () => {
  it('finds every element that is present', () => {
    const array = generateSortedArray(64, 4)
    for (const target of array) {
      const { events } = runToCompletion(binarySearch, array, target)
      const found = events.find((e) => e.kind === 'found')
      expect(found, `expected to find ${target}`).toBeDefined()
      if (found && found.kind === 'found') expect(array[found.i]).toBe(target)
    }
  })

  it('reports exhausted for values that are absent', () => {
    const array = generateSortedArray(50, 9)
    for (const target of [array[0] - 1, array[array.length - 1] + 1, -999]) {
      const { events } = runToCompletion(binarySearch, array, target)
      expect(events.some((e) => e.kind === 'exhausted')).toBe(true)
      expect(events.some((e) => e.kind === 'found')).toBe(false)
    }
  })

  it('never exceeds ceil(log2(n)) + 1 comparisons', () => {
    for (const n of [10, 100, 1000, 5000]) {
      const array = generateSortedArray(n, 2)
      const bound = Math.ceil(Math.log2(n)) + 1
      for (const target of [array[0], array[n - 1], array[n >> 1], -1]) {
        const { events } = runToCompletion(binarySearch, array, target)
        const comparisons = events.filter((e) => e.kind === 'compareTarget').length
        expect(comparisons, `n=${n}, target=${target}`).toBeLessThanOrEqual(bound)
      }
    }
  })

  it('never leaves the array modified', () => {
    const array = generateSortedArray(30, 6)
    const { array: after } = runToCompletion(binarySearch, array, array[10])
    expect(after).toEqual(array)
  })
})

describe('measured growth matches the documented complexity', () => {
  const at = (spec: Spec, n: number, shape: string) => measure(arrays, spec, n, shape, 1)

  it('bubble sort is quadratic on random input', () => {
    const pts = [256, 512, 1024].map((n) => at(SORTS[0], n, 'random'))
    const ratios = growthRatios(pts, 'comparisons')
    expect(ratios[2]!).toBeGreaterThan(3.4)
    expect(ratios[2]!).toBeLessThan(4.6)
  })

  it('bubble sort is linear on already-sorted input (early exit)', () => {
    const pts = [256, 512, 1024].map((n) => at(SORTS[0], n, 'sorted'))
    const ratios = growthRatios(pts, 'comparisons')
    expect(ratios[2]!).toBeGreaterThan(1.7)
    expect(ratios[2]!).toBeLessThan(2.3)
  })

  it('merge sort is n log n and indifferent to input shape', () => {
    const random = at(SORTS[1], 1024, 'random').comparisons
    const sorted = at(SORTS[1], 1024, 'sorted').comparisons
    const reversed = at(SORTS[1], 1024, 'reversed').comparisons

    expect(random).toBeGreaterThan(1024 * 4)
    expect(random).toBeLessThan(1024 * 10)
    // Best and worst case differ by less than 2x — the defining property.
    expect(Math.max(random, sorted, reversed) / Math.min(random, sorted, reversed)).toBeLessThan(2)
  })

  it('quick sort degrades to quadratic on sorted input', () => {
    expect(at(SORTS[2], 1024, 'sorted').comparisons).toBeGreaterThan(
      at(SORTS[2], 1024, 'random').comparisons * 10,
    )
  })

  it('binary search grows logarithmically', () => {
    const small = at(SEARCHES[0], 256, 'random').comparisons
    const large = at(SEARCHES[0], 4096, 'random').comparisons
    // 16x the data should cost about 4 more comparisons, not 16x more.
    expect(large - small).toBeGreaterThan(1)
    expect(large - small).toBeLessThan(6)
  })

  it('averages a search over many targets rather than measuring one lookup', () => {
    // With per-trial targets the mean lands strictly between the best case (1)
    // and the worst (log2 n); a broken makeInput would pin it to a single value.
    const m = measure(arrays, SEARCHES[0], 1024, 'sorted', 1)
    expect(m.comparisons).toBeGreaterThan(2)
    expect(m.comparisons).toBeLessThan(Math.log2(1024) + 1)
    expect(Number.isInteger(m.comparisons)).toBe(false)
  })
})

describe('growth classifier', () => {
  const classOf = (spec: Spec, shape: string) => {
    const pts = [256, 512, 1024].map((n) => measure(arrays, spec, n, shape, 1))
    return classifyRatio(growthRatios(pts, 'comparisons')[2], pts[1].n, pts[2].n)
  }

  it('separates n log n from linear, which fixed ratio bands cannot', () => {
    // Merge sort's real doubling ratio at these sizes is ~2.22 vs linear's
    // 2.00 — close enough that a hand-picked cutoff gets one of them wrong.
    expect(classOf(SORTS[1], 'random')).toBe('≈ n log n')
    expect(classOf(SORTS[0], 'sorted')).toBe('≈ n')
  })

  it('names bubble sort quadratic on random input', () => {
    expect(classOf(SORTS[0], 'random')).toBe('≈ n²')
  })

  it('names quick sort quadratic on sorted input', () => {
    expect(classOf(SORTS[2], 'sorted')).toBe('≈ n²')
  })

  it('names binary search logarithmic', () => {
    expect(classOf(SEARCHES[0], 'random')).toBe('≈ log n')
  })

  it('returns a placeholder when it has nothing to compare against', () => {
    expect(classifyRatio(null, 512, 1024)).toBe('—')
    expect(classifyRatio(2, undefined, undefined)).toBe('—')
  })
})

/**
 * These guard the taxonomy itself. They are written against the registry rather
 * than against arrays specifically, so a future strings/trees structure is held
 * to the same contract the moment it is registered.
 */
describe('structure registry', () => {
  it.each(STRUCTURES.map((s) => [s.name, s] as const))(
    '%s: every algorithm belongs to a declared category',
    (_name, structure) => {
      const known = structure.categories.map((c) => c.id)
      for (const a of structure.algorithms) {
        expect(known, `${a.id} has categoryId "${a.categoryId}"`).toContain(a.categoryId)
      }
    },
  )

  it.each(STRUCTURES.map((s) => [s.name, s] as const))(
    '%s: every algorithm claims this structure',
    (_name, structure) => {
      for (const a of structure.algorithms) expect(a.structureId).toBe(structure.id)
    },
  )

  it.each(STRUCTURES.map((s) => [s.name, s] as const))(
    '%s: declares input shapes and a usable size range',
    (_name, structure) => {
      expect(structure.shapes.length).toBeGreaterThan(0)
      expect(structure.minN).toBeLessThan(structure.maxN)
      expect(structure.defaultN).toBeGreaterThanOrEqual(structure.minN)
      expect(structure.defaultN).toBeLessThanOrEqual(structure.maxN)
    },
  )

  it.each(STRUCTURES.map((s) => [s.name, s] as const))(
    '%s: makeInput and cloneInput produce independent copies',
    (_name, structure) => {
      const spec = structure.algorithms[0]
      const input = structure.makeInput({
        n: structure.defaultN,
        shapeId: structure.shapes[0].id,
        seed: 1,
        trial: 0,
        requiresSortedInput: spec.requiresSortedInput,
      })
      const clone = structure.cloneInput(input)
      expect(clone).toEqual(input)
      expect(clone).not.toBe(input)

      // Running the algorithm on the clone must not disturb the original.
      const before = JSON.stringify(input)
      Array.from(spec.run(clone))
      expect(JSON.stringify(input)).toBe(before)
    },
  )

  it('assigns globally unique colour slots across all structures', () => {
    const slots = STRUCTURES.flatMap((s) => s.algorithms.map((a) => a.colorSlot))
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('assigns globally unique algorithm ids across all structures', () => {
    const ids = STRUCTURES.flatMap((s) => s.algorithms.map((a) => a.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a unique id per structure', () => {
    const ids = STRUCTURES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups arrays into sorting and searching', () => {
    const groups = byCategory(arrays)
    expect(groups.map((g) => g.category.id)).toEqual(['sorting', 'searching'])
    expect(groups[0].algorithms.map((a) => a.id)).toEqual([
      'bubble-sort',
      'merge-sort',
      'quick-sort',
    ])
    expect(groups[1].algorithms.map((a) => a.id)).toEqual(['binary-search'])
  })

  it('omits categories that have no algorithms yet', () => {
    const withEmpty = {
      ...arrays,
      categories: [...arrays.categories, { id: 'ghost', name: 'Ghost', blurb: '' }],
    }
    expect(byCategory(withEmpty).map((g) => g.category.id)).not.toContain('ghost')
  })

  it('round-trips an algorithm through the registry lookup', () => {
    expect(algorithmById(arrays, 'quick-sort').name).toBe('Quick Sort')
    expect(() => algorithmById(arrays, 'nope')).toThrow(/Unknown algorithm/)
  })
})

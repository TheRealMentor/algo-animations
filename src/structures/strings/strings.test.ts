import { describe, expect, it } from 'vitest'
import { strings } from './index'
import { naiveSearch } from './algorithms/naiveSearch'
import { rabinKarp } from './algorithms/rabinKarp'
import { kmp } from './algorithms/kmp'
import type { StringEvent, StringInput } from './model'
import type { AlgorithmSpec } from '../../core/types'
import { buildTimeline, initialState, applyEvent, seek } from '../../core/player'
import { measure, growthRatios, classifyRatio } from '../../core/complexity'
import { generateStrings, patternLength, SHAPES } from './data'
import { makeRng } from '../../lib/rng'

type Spec = AlgorithmSpec<StringInput, StringEvent>

const ALGORITHMS: Spec[] = [naiveSearch, rabinKarp, kmp]

/** Independent of every algorithm under test — trusted by inspection, not by
 *  reuse of naiveSearch's own logic. */
function bruteForcePositions(text: string, pattern: string): number[] {
  const positions: number[] = []
  const n = text.length
  const m = pattern.length
  if (m === 0 || m > n) return positions
  for (let s = 0; s <= n - m; s++) {
    let ok = true
    for (let j = 0; j < m; j++) {
      if (text[s + j] !== pattern[j]) {
        ok = false
        break
      }
    }
    if (ok) positions.push(s)
  }
  return positions
}

function runToCompletion(spec: Spec, input: StringInput) {
  const events = Array.from(spec.run(input))
  const done = events.find((e) => e.kind === 'done')
  const found = events.filter((e) => e.kind === 'found').map((e) => (e as { position: number }).position)
  return { events, found, totalMatches: done && done.kind === 'done' ? done.totalMatches : 0 }
}

const timelineFor = (spec: Spec, input: StringInput) => buildTimeline(strings, spec, input)

describe.each(ALGORITHMS.map((s) => [s.name, s] as const))('%s', (_name, spec) => {
  it.each(SHAPES.map((s) => s.id))('finds exactly the true occurrences under %s shape', (shapeId) => {
    for (const n of [12, 20, 40, 80]) {
      const input = generateStrings(n, shapeId, n * 13 + 1)
      const { found, totalMatches } = runToCompletion(spec, input)
      const truth = bruteForcePositions(input.text, input.pattern)
      expect(found.slice().sort((a, b) => a - b)).toEqual(truth)
      expect(totalMatches).toBe(truth.length)
    }
  })

  it('finds every occurrence against many random text/pattern pairs', () => {
    const rng = makeRng(2024)
    for (let trial = 0; trial < 60; trial++) {
      const alphabetSize = 1 + Math.floor(rng() * 4) // stress small alphabets too
      const alphabet = 'abcd'.slice(0, alphabetSize)
      const n = 5 + Math.floor(rng() * 40)
      const m = 1 + Math.floor(rng() * Math.min(n, 8))
      const text = Array.from({ length: n }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('')
      const pattern = Array.from({ length: m }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('')

      const { found } = runToCompletion(spec, { text, pattern })
      const truth = bruteForcePositions(text, pattern)
      expect(found.slice().sort((a, b) => a - b), `text="${text}" pattern="${pattern}"`).toEqual(truth)
    }
  })

  it('handles an empty text or a pattern longer than the text without crashing', () => {
    expect(runToCompletion(spec, { text: '', pattern: 'a' }).found).toEqual([])
    expect(runToCompletion(spec, { text: 'abc', pattern: 'abcde' }).found).toEqual([])
  })

  it('never mutates its input', () => {
    const input = generateStrings(30, 'random', 5)
    const before = { ...input }
    Array.from(spec.run(input))
    expect(input).toEqual(before)
  })
})

describe('player replay', () => {
  /**
   * The load-bearing invariant, same as arrays: the state the player rebuilds
   * from the event stream must match what the algorithm actually found. If
   * this breaks, the animation is showing matches that were never confirmed.
   */
  it.each(ALGORITHMS.map((s) => [s.name, s] as const))(
    '%s: replayed matches equal the true occurrences',
    (_name, spec) => {
      const input = generateStrings(60, 'many-matches', 7)
      const truth = bruteForcePositions(input.text, input.pattern)

      const timeline = timelineFor(spec, input)
      const finalState = seek(timeline, timeline.events.length)

      expect(finalState.matches.slice().sort((a, b) => a - b)).toEqual(truth)
      expect(finalState.done).toBe(true)
    },
  )

  it('counts the same totals whether replayed once or event by event', () => {
    const input = generateStrings(50, 'random', 3)
    const timeline = timelineFor(kmp, input)
    const s = initialState(timeline)
    for (const e of timeline.events) applyEvent(timeline, s, e)
    expect(s.counters).toEqual(timeline.totalCounters)
  })

  it('reaches identical state whether stepping forward or seeking backward', () => {
    const timeline = timelineFor(rabinKarp, generateStrings(40, 'random', 9))
    const mid = Math.floor(timeline.events.length / 2)

    const forward = seek(timeline, mid)
    const matchedForward = forward.matches.slice()
    const countersForward = { ...forward.counters }

    seek(timeline, timeline.events.length, { state: forward, cursor: mid })
    const back = seek(timeline, mid)

    expect(back.matches).toEqual(matchedForward)
    expect(back.counters).toEqual(countersForward)
  })
})

describe('KMP-specific correctness', () => {
  it('builds a correct LPS table for a textbook pattern', () => {
    // "ababaca" -> classic worked example, LPS = [0,0,1,2,3,0,1]. Text must be
    // at least as long as the pattern, or KMP takes the early-exit path and
    // never builds the table at all.
    const timeline = timelineFor(kmp, { text: 'ababacaababaca', pattern: 'ababaca' })
    const final = seek(timeline, timeline.events.length)
    expect(final.lps).toEqual([0, 0, 1, 2, 3, 0, 1])
  })

  it('finds overlapping matches (text "aaaa", pattern "aa")', () => {
    const { found } = runToCompletion(kmp, { text: 'aaaa', pattern: 'aa' })
    expect(found.sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  it('never re-examines a text position more times than KMP is proven to allow', () => {
    // Total scan comparisons (excluding LPS build) must not exceed 2n for any
    // input — the textbook bound on KMP's amortised work.
    for (const shapeId of ['repetitive', 'random', 'many-matches']) {
      const input = generateStrings(200, shapeId, 11)
      const events = Array.from(kmp.run(input))
      const scanCompares = events.filter(
        (e) => e.kind === 'compare' && e.scope === 'scan',
      ).length
      expect(scanCompares, shapeId).toBeLessThanOrEqual(2 * input.text.length)
    }
  })
})

describe('measured growth matches the documented complexity', () => {
  const at = (spec: Spec, n: number, shape: string) => measure(strings, spec, n, shape, 1)

  it('naive search is quadratic under the repetitive (worst-case) shape', () => {
    const pts = [64, 128, 256].map((n) => at(naiveSearch, n, 'repetitive'))
    const ratios = growthRatios(pts, 'comparisons')
    // Pattern length scales with n, so worst-case Naive is genuinely O(n·m) ~ O(n²) here.
    expect(ratios[2]!).toBeGreaterThan(3.2)
  })

  it('naive search stays roughly linear on random input', () => {
    const pts = [128, 256, 512].map((n) => at(naiveSearch, n, 'random'))
    const ratios = growthRatios(pts, 'comparisons')
    expect(ratios[2]!).toBeLessThan(3)
  })

  it('KMP stays linear even under the shape that breaks naive search', () => {
    const naiveRatio = growthRatios(
      [64, 128, 256].map((n) => at(naiveSearch, n, 'repetitive')),
      'comparisons',
    )[2]!
    const kmpRatio = growthRatios(
      [64, 128, 256].map((n) => at(kmp, n, 'repetitive')),
      'comparisons',
    )[2]!
    expect(kmpRatio).toBeLessThan(2.5)
    expect(kmpRatio).toBeLessThan(naiveRatio)
  })

  it('Rabin-Karp does mostly cheap hash reads, not full comparisons, on random input', () => {
    const m = at(rabinKarp, 512, 'random')
    // countOnly's `read` tally includes 2 reads per compare too, but with
    // almost every window failing on the hash alone, comparisons should stay
    // a small fraction of the total work.
    expect(m.comparisons).toBeLessThan(512)
  })

  it('classifies naive-under-repetitive as quadratic and KMP-under-repetitive as linear', () => {
    const classOf = (spec: Spec, shape: string) => {
      const pts = [64, 128, 256].map((n) => measure(strings, spec, n, shape, 1))
      return classifyRatio(growthRatios(pts, 'comparisons')[2], pts[1].n, pts[2].n)
    }
    expect(classOf(naiveSearch, 'repetitive')).toBe('≈ n²')
    expect(classOf(kmp, 'repetitive')).toBe('≈ n')
  })
})

describe('structure contract', () => {
  it('derives a pattern length strictly between 3 and n for every size the UI allows', () => {
    for (const n of [strings.minN, strings.defaultN, strings.maxN, 4096]) {
      const m = patternLength(n)
      expect(m).toBeGreaterThanOrEqual(3)
      expect(m).toBeLessThanOrEqual(n)
    }
  })

  it('every shape produces text/pattern makeInput can round-trip through cloneInput', () => {
    for (const shape of SHAPES) {
      const input = strings.makeInput({
        n: strings.defaultN,
        shapeId: shape.id,
        seed: 1,
        trial: 0,
        requiresSortedInput: false,
      })
      expect(strings.cloneInput(input)).toEqual(input)
    }
  })

  it('describeInput reports the pattern and truncates long ones', () => {
    expect(strings.describeInput!({ text: 'x', pattern: 'abc' })).toContain('"abc"')
    const long = 'a'.repeat(50)
    const caption = strings.describeInput!({ text: 'x', pattern: long })!
    expect(caption.length).toBeLessThan(long.length)
  })
})

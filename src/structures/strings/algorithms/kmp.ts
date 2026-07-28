import type { AlgorithmSpec } from '../../../core/types'
import type { StringEvent, StringInput } from '../model'

/**
 * Knuth-Morris-Pratt: precompute, for every prefix of the pattern, the length
 * of the longest proper prefix that is also a suffix (the "LPS"/failure
 * table). On a mismatch, that table says exactly how much of the match just
 * built can be reused — so the text pointer never backs up, and the total
 * work is O(n+m) no matter what the input looks like. This is the one
 * algorithm in this trio whose worst case equals its best case.
 *
 * The LPS build is itself a small self-comparison (pattern against pattern)
 * and is emitted as real `compare` events — it's genuine work, not free
 * setup, the same way merge sort's aux-buffer copy is real reads and writes,
 * not something the profiler is allowed to ignore.
 */
function* buildLps(pattern: string): Generator<StringEvent, number[]> {
  const m = pattern.length
  const lps = new Array(m).fill(0)
  let len = 0
  let i = 1

  while (i < m) {
    const matched = pattern[i] === pattern[len]
    yield { kind: 'compare', scope: 'lps', i, j: len, matched }

    if (matched) {
      len++
      lps[i] = len
      i++
    } else if (len !== 0) {
      len = lps[len - 1]
    } else {
      lps[i] = 0
      i++
    }
  }

  yield { kind: 'lpsInit', values: lps.slice() }
  return lps
}

function* run({ text, pattern }: StringInput): Generator<StringEvent> {
  const n = text.length
  const m = pattern.length
  if (m === 0 || m > n) {
    yield { kind: 'done', totalMatches: 0 }
    return
  }

  const lps = yield* buildLps(pattern)

  let i = 0 // text pointer
  let j = 0 // pattern pointer
  let matches = 0

  while (i < n) {
    // The implied window start is i - j: however far the pointers have
    // advanced together defines the current alignment, the same way `s` did
    // for Naive and Rabin-Karp's explicit sliding window.
    yield { kind: 'align', windowStart: i - j, matchedCount: j }

    const matched = text[i] === pattern[j]
    yield { kind: 'compare', scope: 'scan', textIndex: i, patternIndex: j, matched }

    if (matched) {
      i++
      j++
      if (j === m) {
        yield { kind: 'found', position: i - j }
        matches++
        yield { kind: 'lpsLookup', i: j - 1 }
        const fallback = lps[j - 1]
        yield { kind: 'skip', from: i - j, to: i - fallback }
        j = fallback
        yield { kind: 'align', windowStart: i - j, matchedCount: j }
      }
    } else if (j !== 0) {
      yield { kind: 'lpsLookup', i: j - 1 }
      const fallback = lps[j - 1]
      yield { kind: 'skip', from: i - j, to: i - fallback }
      j = fallback
      // i does not advance — the loop retries text[i] against pattern[j].
    } else {
      i++
      yield { kind: 'align', windowStart: i, matchedCount: 0 }
    }
  }

  yield { kind: 'done', totalMatches: matches }
}

export const kmp: AlgorithmSpec<StringInput, StringEvent> = {
  id: 'kmp',
  name: 'KMP',
  structureId: 'strings',
  categoryId: 'pattern-matching',
  blurb:
    'Precomputes how much of the pattern can safely be reused after a mismatch, so the text is never re-scanned — the only one of these three with no worst case worse than its average.',
  complexity: {
    best: 'O(n+m)',
    average: 'O(n+m)',
    worst: 'O(n+m)',
    space: 'O(m)',
  },
  expectedGrowth: 'n',
  requiresSortedInput: false,
  profileTrials: 8,
  colorSlot: 7,
  secondaryStat: { label: 'Reads', value: (c) => c.reads },
  run,
}

import type { AlgorithmSpec } from '../../../core/types'
import type { StringEvent, StringInput } from '../model'

/**
 * Brute-force pattern matching: try every possible starting position, and at
 * each one compare characters left to right until either the whole pattern
 * matches or one character doesn't.
 *
 * This is the "bubble sort" of this trio — the baseline every smarter
 * algorithm is measured against, and the one whose worst case is easiest to
 * trigger on purpose (see the 'repetitive' shape).
 */
function* run({ text, pattern }: StringInput): Generator<StringEvent> {
  const n = text.length
  const m = pattern.length
  if (m === 0 || m > n) {
    yield { kind: 'done', totalMatches: 0 }
    return
  }

  let matches = 0

  for (let s = 0; s <= n - m; s++) {
    yield { kind: 'align', windowStart: s, matchedCount: 0 }

    let j = 0
    while (j < m) {
      const matched = text[s + j] === pattern[j]
      yield { kind: 'compare', scope: 'scan', textIndex: s + j, patternIndex: j, matched }
      if (!matched) break
      j++
      yield { kind: 'align', windowStart: s, matchedCount: j }
    }

    if (j === m) {
      yield { kind: 'found', position: s }
      matches++
    }
  }

  yield { kind: 'done', totalMatches: matches }
}

export const naiveSearch: AlgorithmSpec<StringInput, StringEvent> = {
  id: 'naive-search',
  name: 'Naive Search',
  structureId: 'strings',
  categoryId: 'pattern-matching',
  blurb:
    'Tries every starting position in turn, comparing characters left to right until the pattern matches or one character breaks it.',
  complexity: {
    best: 'O(n)',
    average: 'O(n)',
    worst: 'O(n·m)',
    space: 'O(1)',
  },
  expectedGrowth: 'n',
  requiresSortedInput: false,
  profileTrials: 8,
  colorSlot: 5,
  secondaryStat: { label: 'Reads', value: (c) => c.reads },
  run,
}

import type { AlgorithmSpec } from '../../../core/types'
import type { StringEvent, StringInput } from '../model'

/**
 * Rabin-Karp: instead of comparing characters at every window, compare a
 * rolling hash of the window against the pattern's hash first — O(1) per
 * window — and only fall through to a real character-by-character check when
 * the hashes agree (which also guards against the rare hash collision).
 *
 * That hash check is emitted as a `read`, not a `compare` — it is genuinely
 * cheaper than a character comparison, and that distinction is the whole
 * point of hashing. Watch the "Reads" counter climb quickly while
 * "Comparisons" barely moves, except under the 'many-matches' shape, where
 * real verification work is unavoidable at every window.
 */
const BASE = 257
const MOD = 1_000_000_007

function code(ch: string): number {
  return ch.charCodeAt(0)
}

function* run({ text, pattern }: StringInput): Generator<StringEvent> {
  const n = text.length
  const m = pattern.length
  if (m === 0 || m > n) {
    yield { kind: 'done', totalMatches: 0 }
    return
  }

  let highPow = 1
  for (let k = 0; k < m - 1; k++) highPow = (highPow * BASE) % MOD

  let patternHash = 0
  let windowHash = 0
  for (let k = 0; k < m; k++) {
    patternHash = (patternHash * BASE + code(pattern[k])) % MOD
    windowHash = (windowHash * BASE + code(text[k])) % MOD
  }

  let matches = 0

  for (let s = 0; s <= n - m; s++) {
    yield { kind: 'align', windowStart: s, matchedCount: 0 }
    yield { kind: 'read', textIndex: s }

    if (windowHash === patternHash) {
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

    if (s < n - m) {
      const leading = (code(text[s]) * highPow) % MOD
      let next = (windowHash - leading) % MOD
      if (next < 0) next += MOD
      windowHash = (next * BASE + code(text[s + m])) % MOD
    }
  }

  yield { kind: 'done', totalMatches: matches }
}

export const rabinKarp: AlgorithmSpec<StringInput, StringEvent> = {
  id: 'rabin-karp',
  name: 'Rabin-Karp',
  structureId: 'strings',
  categoryId: 'pattern-matching',
  blurb:
    'Hashes the pattern once, then slides a rolling hash across the text — only falling back to a real character comparison when a window’s hash matches.',
  complexity: {
    best: 'O(n+m)',
    average: 'O(n+m)',
    worst: 'O(n·m)',
    space: 'O(1)',
  },
  expectedGrowth: 'n',
  requiresSortedInput: false,
  profileTrials: 8,
  colorSlot: 6,
  secondaryStat: { label: 'Hash checks + reads', value: (c) => c.reads },
  run,
}

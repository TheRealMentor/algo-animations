import type { InputShape } from '../../core/types'
import { makeRng } from '../../lib/rng'
import type { StringInput } from './model'

/**
 * Input shapes for strings — the pattern-matching equivalent of arrays'
 * sorted/reversed/few-unique. Where an array shape controls element order,
 * a string shape controls how often (and how nearly) the pattern recurs in
 * the text, since that's what actually separates these algorithms' best,
 * average, and worst cases.
 */
export type StringShape = 'random' | 'repetitive' | 'no-match' | 'many-matches'

export const SHAPES: InputShape[] = [
  {
    id: 'random',
    label: 'Random',
    hint: 'The average case — with more than a couple of letters in play, mismatches happen almost immediately.',
  },
  {
    id: 'repetitive',
    label: 'Repetitive',
    hint: 'Naive backtracks nearly the whole pattern at every position — its true worst case. KMP is unaffected.',
  },
  {
    id: 'no-match',
    label: 'No match',
    hint: 'The pattern never occurs, so every algorithm has to scan the entire text before giving up.',
  },
  {
    id: 'many-matches',
    label: 'Many matches',
    hint: 'The pattern recurs constantly — every occurrence still has to be verified, one character at a time.',
  },
]

/** A modest alphabet: small enough that accidental partial matches are common
 *  (which is what makes 'random' text interesting), large enough that a true
 *  full match essentially never happens by chance. */
const ALPHABET = 'abcdefghij'

/**
 * Pattern length as a fraction of text length, applied uniformly across every
 * shape. This is what lets a single "Items" slider mean the same thing no
 * matter which algorithm or shape is selected: text length n and pattern
 * length m grow together, so Naive's O(n·m) worst case actually renders as a
 * quadratic curve as n increases — with m held fixed instead, the same worst
 * case would just be O(n) with a larger constant, and the whole point of the
 * Complexity Lab (watch the shape of the curve change) would be lost.
 */
export function patternLength(n: number): number {
  return Math.max(3, Math.round(n * 0.2))
}

function randomChar(rng: () => number, alphabet: string): string {
  return alphabet[Math.floor(rng() * alphabet.length)]
}

function randomString(rng: () => number, length: number, alphabet: string): string {
  return Array.from({ length }, () => randomChar(rng, alphabet)).join('')
}

export function generateStrings(n: number, shapeId: string, seed: number): StringInput {
  const rng = makeRng(seed)
  const m = patternLength(n)

  switch (shapeId as StringShape) {
    case 'repetitive': {
      // Classic Naive pathology: a run of one character, with a pattern that
      // matches every position but the very last — so every window fails as
      // late as possible. KMP's LPS table absorbs this shape completely.
      const text = 'a'.repeat(n)
      const pattern = 'a'.repeat(Math.max(0, m - 1)) + 'b'
      return { text, pattern }
    }

    case 'no-match': {
      // 'z' never appears in ALPHABET, so appending it guarantees the pattern
      // cannot occur — forcing a full scan with no early success anywhere.
      const text = randomString(rng, n, ALPHABET)
      const pattern = randomString(rng, Math.max(1, m - 1), ALPHABET) + 'z'
      return { text, pattern }
    }

    case 'many-matches': {
      // Tiling one short unit across the whole text guarantees the pattern
      // recurs every `unit.length` characters — dense, genuine matches, each
      // one still requiring a real verification pass.
      const unitLength = Math.max(2, Math.min(m, 6))
      const unit = randomString(rng, unitLength, ALPHABET)
      const repeats = Math.max(1, Math.ceil(n / unit.length))
      const text = unit.repeat(repeats).slice(0, n)
      return { text, pattern: unit }
    }

    case 'random':
    default: {
      const text = randomString(rng, n, ALPHABET)
      const pattern = randomString(rng, m, ALPHABET)
      return { text, pattern }
    }
  }
}

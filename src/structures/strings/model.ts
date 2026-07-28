import type { BaseState, Counters } from '../../core/types'
import { zeroCounters } from '../../core/types'

/**
 * The string domain: pattern matching over text.
 *
 * There is no "magnitude" here — a character has no height to draw as a bar —
 * so the state model is identity-based (which cell has which role) rather than
 * value-based like arrays. Two ideas carry across from arrays anyway:
 *
 *   - `compare` and `read` are the shared cost vocabulary from `core/types`.
 *     `compare` is a real character-vs-character check (Naive, KMP, and RK's
 *     verification step); `read` is Rabin-Karp's O(1) rolling-hash check, which
 *     is genuinely cheaper than a comparison and should be counted as such —
 *     that distinction is the whole point of hashing.
 *   - `windowStart` + `matchedCount` play the role arrays' `range` + `sorted[]`
 *     played: one small pair of numbers that every algorithm here can express
 *     its progress through. For KMP, whose two pointers (i, j) don't map onto
 *     an explicit sliding window the way Naive's or Rabin-Karp's do, the
 *     equivalent window start is simply `i - j` — the alignment implied by
 *     however far the text and pattern pointers have advanced.
 */

/** Which of the pattern's own characters are being compared, during LPS
 *  construction (KMP only) — pattern[i] against pattern[j]. */
export interface SelfCompare {
  i: number
  j: number
}

export type StringEvent =
  /** scope 'scan': text[textIndex] vs pattern[patternIndex]. scope 'lps': the
   *  one-time table build, pattern[i] vs pattern[j]. Both are real character
   *  comparisons and both count. */
  | { kind: 'compare'; scope: 'scan'; textIndex: number; patternIndex: number; matched: boolean }
  | { kind: 'compare'; scope: 'lps'; i: number; j: number; matched: boolean }
  /** Rabin-Karp: an O(1) rolling-hash check of the window starting here —
   *  cheaper than a character comparison, so it's tallied as a read, not a
   *  compare. */
  | { kind: 'read'; textIndex: number }
  /** Authoritative "this is the state of the scan now" update: where the
   *  window starts, and how many leading pattern characters match there. */
  | { kind: 'align'; windowStart: number; matchedCount: number }
  /** KMP: the window advanced past [from, to) without re-comparing — the
   *  whole reason it's asymptotically better than Naive. */
  | { kind: 'skip'; from: number; to: number }
  /** KMP: the failure/LPS table, computed once before the scan starts. */
  | { kind: 'lpsInit'; values: number[] }
  /** KMP: consulting lps[i] to decide how far to fall back. */
  | { kind: 'lpsLookup'; i: number }
  /** A full match confirmed, starting at this text index. Persists — this is
   *  the string structure's equivalent of arrays' `sorted`. */
  | { kind: 'found'; position: number }
  /** The scan is complete. */
  | { kind: 'done'; totalMatches: number }
  | { kind: 'note'; text: string }

export interface StringInput {
  text: string
  pattern: string
}

export type CellRole =
  | 'idle'
  | 'window'
  | 'comparing'
  | 'match'
  | 'mismatch'
  | 'found'
  | 'skip'
  | 'hash-checking'

export interface StringState extends BaseState {
  text: string
  pattern: string
  /** Non-null only for KMP. */
  lps: number[] | null

  windowStart: number
  matchedCount: number
  matches: number[]

  // Transient — cleared at the start of every event, set by at most one kind.
  scanText: number | null
  scanPattern: number | null
  lpsBuildI: number | null
  lpsBuildJ: number | null
  mismatchAt: number | null
  hashCheckAt: number | null
  skipRange: [number, number] | null
  lpsLookupIndex: number | null

  done: boolean
  totalMatches: number
  counters: Counters
  note: string
}

export function initialStringState(input: StringInput): StringState {
  return {
    text: input.text,
    pattern: input.pattern,
    lps: null,
    windowStart: 0,
    matchedCount: 0,
    matches: [],
    scanText: null,
    scanPattern: null,
    lpsBuildI: null,
    lpsBuildJ: null,
    mismatchAt: null,
    hashCheckAt: null,
    skipRange: null,
    lpsLookupIndex: null,
    done: false,
    totalMatches: 0,
    counters: zeroCounters(),
    note: '',
  }
}

function clearTransient(s: StringState): void {
  s.scanText = null
  s.scanPattern = null
  s.lpsBuildI = null
  s.lpsBuildJ = null
  s.mismatchAt = null
  s.hashCheckAt = null
  s.skipRange = null
  s.lpsLookupIndex = null
}

export function applyStringEvent(s: StringState, e: StringEvent): void {
  clearTransient(s)

  switch (e.kind) {
    case 'compare':
      if (e.scope === 'scan') {
        s.scanText = e.textIndex
        s.scanPattern = e.patternIndex
        if (!e.matched) s.mismatchAt = e.textIndex
      } else {
        s.lpsBuildI = e.i
        s.lpsBuildJ = e.j
      }
      break

    case 'read':
      s.hashCheckAt = e.textIndex
      break

    case 'align':
      s.windowStart = e.windowStart
      s.matchedCount = e.matchedCount
      break

    case 'skip':
      s.skipRange = [e.from, e.to]
      break

    case 'lpsInit':
      s.lps = e.values.slice()
      break

    case 'lpsLookup':
      s.lpsLookupIndex = e.i
      break

    case 'found':
      s.matches.push(e.position)
      break

    case 'done':
      s.done = true
      s.totalMatches = e.totalMatches
      break

    case 'note':
      s.note = e.text
      break
  }
}

/**
 * Role priority, most specific first: an in-progress comparison or mismatch
 * always wins over the calmer "this is part of a confirmed match" states, the
 * way arrays' `roleAt` puts swapping/writing ahead of sorted.
 */
export function textCellRole(s: StringState, i: number): CellRole {
  if (s.mismatchAt === i) return 'mismatch'
  if (s.scanText === i) return 'comparing'
  if (s.hashCheckAt !== null && i >= s.hashCheckAt && i < s.hashCheckAt + s.pattern.length) {
    return 'hash-checking'
  }
  if (s.matches.some((m) => i >= m && i < m + s.pattern.length)) return 'found'
  if (i >= s.windowStart && i < s.windowStart + s.matchedCount) return 'match'
  if (s.skipRange && i >= s.skipRange[0] && i < s.skipRange[1]) return 'skip'
  if (i >= s.windowStart && i < s.windowStart + s.pattern.length) return 'window'
  return 'idle'
}

export function patternCellRole(s: StringState, j: number): CellRole {
  if (s.scanPattern === j) return 'comparing'
  if (s.lpsBuildI === j || s.lpsBuildJ === j) return 'comparing'
  if (j < s.matchedCount) return 'match'
  return 'idle'
}

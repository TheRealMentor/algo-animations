import type { BaseState, Counters } from '../../core/types'
import { zeroCounters } from '../../core/types'

/**
 * The array domain: its event vocabulary and its visual state.
 *
 * `compare`, `compareTarget`, `swap`, `write`, and `read` are the shared cost
 * vocabulary from `core/types` — the profiler counts them without knowing
 * anything about arrays. The rest are presentation-only and cost nothing.
 */

/** Which row of bars an event refers to. Merge sort is the only user of `aux`. */
export type Region = 'main' | 'aux'

export type ArrayEvent =
  | { kind: 'compare'; i: number; j: number; region?: Region }
  | { kind: 'compareTarget'; i: number }
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'write'; i: number; value: number; prev: number; region?: Region }
  | { kind: 'read'; i: number; region?: Region }
  | { kind: 'range'; lo: number; hi: number }
  | { kind: 'pivot'; i: number }
  | { kind: 'probe'; i: number }
  | { kind: 'sorted'; i: number }
  | { kind: 'found'; i: number }
  | { kind: 'exhausted' }
  | { kind: 'auxInit'; values: number[] }
  | { kind: 'note'; text: string }

export interface ArrayInput {
  array: number[]
  /** Only meaningful for search algorithms. */
  target?: number
}

/** Exactly one role per bar, so styling never untangles overlapping flags. */
export type BarRole =
  | 'idle'
  | 'out-of-range'
  | 'sorted'
  | 'reading'
  | 'comparing'
  | 'writing'
  | 'swapping'
  | 'pivot'
  | 'probe'
  | 'found'

export interface ArrayState extends BaseState {
  array: number[]
  aux: number[] | null
  sorted: boolean[]
  range: [number, number] | null
  pivot: number | null
  probe: number | null
  found: number | null
  exhausted: boolean
  /** Transient, cleared on every event: what this specific step touched. */
  comparing: number[]
  comparingAux: number[]
  swapping: number[]
  writing: number[]
  writingAux: number[]
  reading: number[]
  readingAux: number[]
  counters: Counters
  note: string
}

export function initialArrayState(input: ArrayInput): ArrayState {
  return {
    array: input.array.slice(),
    aux: null,
    sorted: new Array(input.array.length).fill(false),
    range: null,
    pivot: null,
    probe: null,
    found: null,
    exhausted: false,
    comparing: [],
    comparingAux: [],
    swapping: [],
    writing: [],
    writingAux: [],
    reading: [],
    readingAux: [],
    counters: zeroCounters(),
    note: '',
  }
}

/** Clears per-step highlights but keeps durable state (sorted, range, …). */
function clearTransient(s: ArrayState): void {
  if (s.comparing.length) s.comparing = []
  if (s.comparingAux.length) s.comparingAux = []
  if (s.swapping.length) s.swapping = []
  if (s.writing.length) s.writing = []
  if (s.writingAux.length) s.writingAux = []
  if (s.reading.length) s.reading = []
  if (s.readingAux.length) s.readingAux = []
}

export function applyArrayEvent(s: ArrayState, e: ArrayEvent): void {
  clearTransient(s)

  switch (e.kind) {
    case 'compare':
      if (e.region === 'aux') s.comparingAux = [e.i, e.j]
      else s.comparing = [e.i, e.j]
      break

    case 'compareTarget':
      s.comparing = [e.i]
      break

    case 'swap': {
      s.swapping = [e.i, e.j]
      const tmp = s.array[e.i]
      s.array[e.i] = s.array[e.j]
      s.array[e.j] = tmp
      break
    }

    case 'write':
      if (e.region === 'aux') {
        if (s.aux) s.aux[e.i] = e.value
        s.writingAux = [e.i]
      } else {
        s.array[e.i] = e.value
        s.writing = [e.i]
      }
      break

    case 'read':
      if (e.region === 'aux') s.readingAux = [e.i]
      else s.reading = [e.i]
      break

    case 'range':
      s.range = [e.lo, e.hi]
      break

    case 'pivot':
      s.pivot = e.i
      break

    case 'probe':
      s.probe = e.i
      break

    case 'sorted':
      s.sorted[e.i] = true
      if (s.pivot === e.i) s.pivot = null
      break

    case 'found':
      s.found = e.i
      s.range = null
      s.probe = null
      break

    case 'exhausted':
      s.exhausted = true
      s.range = null
      s.probe = null
      break

    case 'auxInit':
      s.aux = e.values.slice()
      break

    case 'note':
      s.note = e.text
      break
  }
}

export function roleAt(s: ArrayState, i: number, region: Region): BarRole {
  if (region === 'aux') {
    if (s.comparingAux.includes(i)) return 'comparing'
    if (s.writingAux.includes(i)) return 'writing'
    if (s.readingAux.includes(i)) return 'reading'
    if (s.range && (i < s.range[0] || i > s.range[1])) return 'out-of-range'
    return 'idle'
  }

  if (s.found === i) return 'found'
  if (s.swapping.includes(i)) return 'swapping'
  if (s.writing.includes(i)) return 'writing'
  if (s.probe === i) return 'probe'
  if (s.comparing.includes(i)) return 'comparing'
  if (s.pivot === i) return 'pivot'
  if (s.reading.includes(i)) return 'reading'
  if (s.sorted[i]) return 'sorted'
  if (s.range && (i < s.range[0] || i > s.range[1])) return 'out-of-range'
  return 'idle'
}

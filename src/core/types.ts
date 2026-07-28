import type { ComponentType } from 'react'

/**
 * The shared vocabulary, one level above any specific data structure.
 *
 * The taxonomy is: Data Structure → Category → Algorithm.
 *
 *   Arrays  → Sorting   → Bubble / Merge / Quick
 *           → Searching → Binary Search
 *   Trees   → Traversal → …            (not built yet)
 *   Strings → Matching  → …            (not built yet)
 *
 * A `DataStructure` owns everything that varies between structures: how inputs
 * are generated, what the visual state looks like, how an event mutates it, and
 * how it renders. The engine in this folder is generic over all of that, so
 * adding a structure never means touching the player, the profiler, or the
 * chart. See `src/structures/README.md` for the checklist.
 */

/* ----------------------------------------------------------------- counters */

export interface Counters {
  comparisons: number
  swaps: number
  writes: number
  reads: number
}

export const zeroCounters = (): Counters => ({
  comparisons: 0,
  swaps: 0,
  writes: 0,
  reads: 0,
})

export const arrayAccesses = (c: Counters): number => c.reads + c.writes

/* ------------------------------------------------------------------- events */

/**
 * Every event carries a `kind`. Structures define their own union on top of
 * this — see `ArrayEvent`.
 *
 * The counter vocabulary below is shared on purpose: `compare`, `compareTarget`,
 * `swap`, `write`, and `read` mean the same thing whatever they operate on, so a
 * new structure that emits them gets counted, charted, and profiled for free.
 * A structure needing a genuinely new cost unit adds it to `tallyEvent` — that
 * one function is the single place operation costs are defined.
 */
export interface BaseEvent {
  kind: string
}

export interface BaseState {
  counters: Counters
}

export function tallyEvent(c: Counters, e: BaseEvent): void {
  switch (e.kind) {
    case 'compare':
      c.comparisons++
      c.reads += 2
      break
    case 'compareTarget':
      c.comparisons++
      c.reads += 1
      break
    case 'swap':
      c.swaps++
      c.reads += 2
      c.writes += 2
      break
    case 'write':
      c.writes++
      break
    case 'read':
      c.reads++
      break
    default:
      // Presentation-only events (range, pivot, note, …) cost nothing.
      break
  }
}

/* --------------------------------------------------------------- algorithms */

export interface Complexity {
  best: string
  average: string
  worst: string
  space: string
}

export type GrowthModel = 'log n' | 'n' | 'n log n' | 'n²'

/** A grouping of algorithms within one data structure. */
export interface Category {
  id: string
  name: string
  blurb: string
}

/** How an input is shaped — arrays have sorted/reversed/…, trees would have
 *  balanced/degenerate/…, so the list belongs to the structure. */
export interface InputShape {
  id: string
  label: string
  hint: string
}

export interface AlgorithmSpec<TInput = unknown, TEvent extends BaseEvent = BaseEvent> {
  id: string
  name: string
  /** Which data structure this operates on. Must match a registered structure. */
  structureId: string
  /** Which of that structure's categories it belongs to. */
  categoryId: string
  blurb: string
  complexity: Complexity
  expectedGrowth: GrowthModel
  /** Needs ordered input to be meaningful (binary search). */
  requiresSortedInput: boolean
  /**
   * Runs to average when profiling. Use 1 for deterministic algorithms; a
   * search over random targets needs many runs or its curve is pure noise.
   */
  profileTrials: number
  /**
   * Categorical palette slot, 1-indexed, unique across ALL structures.
   * Assigned in fixed order and never recycled — the order is the
   * colourblind-safety mechanism, not a style choice.
   */
  colorSlot: number
  /**
   * The second stat tile in the Visualizer's "This run" panel. Defaults to
   * swaps, which is right for sorts and wrong for everything else (a search
   * that never swaps would just show a dead "0" tile). Override per algorithm
   * rather than branching the UI on `requiresSortedInput` — that was a proxy
   * that happened to work for one algorithm and would not have generalised.
   */
  secondaryStat?: { label: string; value: (counters: Counters) => number }
  run(input: TInput): Generator<TEvent>
}

/* ----------------------------------------------------------------- structure */

export interface MakeInputOptions {
  n: number
  shapeId: string
  seed: number
  /** Trial index when profiling with `profileTrials > 1`. 0 for the visualizer. */
  trial: number
  requiresSortedInput: boolean
}

export interface DataStructure<
  TState extends BaseState = BaseState,
  TEvent extends BaseEvent = BaseEvent,
  TInput = unknown,
> {
  id: string
  name: string
  blurb: string
  categories: Category[]
  algorithms: Array<AlgorithmSpec<TInput, TEvent>>
  /** Input shapes offered for this structure. */
  shapes: InputShape[]

  /** Size bounds for the animated view — a legibility limit, not a perf one. */
  minN: number
  maxN: number
  defaultN: number

  makeInput(opts: MakeInputOptions): TInput
  /** Algorithms mutate their input, so the engine needs a private copy. */
  cloneInput(input: TInput): TInput

  initialState(input: TInput): TState
  applyEvent(state: TState, event: TEvent): void

  View: ComponentType<{ state: TState; cursor: number }>
  Legend: ComponentType

  /** Optional caption describing the specific input, e.g. a search target. */
  describeInput?(input: TInput): string | null
}

/** Convenience alias for a structure whose type parameters we don't care about. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDataStructure = DataStructure<any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAlgorithmSpec = AlgorithmSpec<any, any>

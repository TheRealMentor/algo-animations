import type {
  AlgorithmSpec,
  BaseEvent,
  BaseState,
  Counters,
  DataStructure,
} from './types'
import { tallyEvent, zeroCounters } from './types'

/**
 * Generic over the structure's state and event types, so the same playback
 * machinery drives arrays today and trees or strings later without changes.
 */
export interface Timeline<
  TState extends BaseState,
  TEvent extends BaseEvent,
  TInput,
> {
  structure: DataStructure<TState, TEvent, TInput>
  spec: AlgorithmSpec<TInput, TEvent>
  /** The pristine input. Replay always restarts from here. */
  input: TInput
  events: TEvent[]
  /** Counters after the final event — the cost of the whole run. */
  totalCounters: Counters
}

/**
 * Runs the algorithm to completion and captures its event stream.
 *
 * The algorithm mutates the clone it is handed; `input` stays pristine so any
 * point in the run can be rebuilt by replaying from the start.
 */
export function buildTimeline<
  TState extends BaseState,
  TEvent extends BaseEvent,
  TInput,
>(
  structure: DataStructure<TState, TEvent, TInput>,
  spec: AlgorithmSpec<TInput, TEvent>,
  input: TInput,
): Timeline<TState, TEvent, TInput> {
  const events = Array.from(spec.run(structure.cloneInput(input)))

  const totalCounters = zeroCounters()
  for (const e of events) tallyEvent(totalCounters, e)

  return { structure, spec, input, events, totalCounters }
}

export function initialState<
  TState extends BaseState,
  TEvent extends BaseEvent,
  TInput,
>(timeline: Timeline<TState, TEvent, TInput>): TState {
  return timeline.structure.initialState(timeline.input)
}

/** Applies one event: the structure's visual update, plus the shared tally. */
export function applyEvent<
  TState extends BaseState,
  TEvent extends BaseEvent,
  TInput,
>(
  timeline: Timeline<TState, TEvent, TInput>,
  state: TState,
  event: TEvent,
): void {
  timeline.structure.applyEvent(state, event)
  tallyEvent(state.counters, event)
}

/**
 * Rebuilds state at cursor position `k` (number of events applied).
 *
 * Stepping forward from a known state is the fast path and the common one.
 * Stepping backward or scrubbing replays from the beginning — an integer-only
 * loop that stays imperceptible at playground sizes, and far simpler than
 * making every event invertible.
 */
export function seek<TState extends BaseState, TEvent extends BaseEvent, TInput>(
  timeline: Timeline<TState, TEvent, TInput>,
  target: number,
  from?: { state: TState; cursor: number },
): TState {
  const clamped = Math.max(0, Math.min(target, timeline.events.length))

  let state: TState
  let cursor: number

  if (from && from.cursor <= clamped) {
    state = from.state
    cursor = from.cursor
  } else {
    state = initialState(timeline)
    cursor = 0
  }

  for (let k = cursor; k < clamped; k++) applyEvent(timeline, state, timeline.events[k])
  return state
}

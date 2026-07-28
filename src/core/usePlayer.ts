import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Timeline } from './player'
import { seek } from './player'
import type { BaseEvent, BaseState } from './types'

/**
 * Maps a 1–100 slider to events/second on a log scale, so the low end is
 * step-by-step readable and the high end can finish a 100k-event bubble sort
 * without anyone waiting.
 */
export function speedToEps(speed: number): number {
  const MIN = 2
  const MAX = 20000
  const t = Math.max(0, Math.min(1, (speed - 1) / 99))
  return Math.round(MIN * Math.pow(MAX / MIN, t))
}

export interface PlayerApi<TState> {
  state: TState | null
  cursor: number
  total: number
  playing: boolean
  speed: number
  eventsPerSecond: number
  atEnd: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  stepForward: () => void
  stepBackward: () => void
  scrub: (cursor: number) => void
  restart: () => void
  finish: () => void
  setSpeed: (speed: number) => void
}

export function usePlayer<
  TState extends BaseState,
  TEvent extends BaseEvent,
  TInput,
>(timeline: Timeline<TState, TEvent, TInput> | null): PlayerApi<TState> {
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(45)

  const total = timeline?.events.length ?? 0
  const eventsPerSecond = speedToEps(speed)

  /**
   * Fast-path cache for `seek`. Stepping forward reuses the last computed
   * state; scrubbing backward falls back to a replay from zero.
   *
   * NOTE: `seek` mutates and returns this same object on the forward path, so
   * `state` is not a fresh reference every tick. Re-renders are driven by the
   * `cursor` state change instead. Do not wrap a structure's `View` in
   * `React.memo` without also giving it `cursor` as a prop — it would go stale.
   */
  const cache = useRef<{ state: TState; cursor: number } | null>(null)

  // A new timeline invalidates everything.
  useEffect(() => {
    setCursor(0)
    setPlaying(false)
    cache.current = null
  }, [timeline])

  const state = useMemo(() => {
    if (!timeline) return null
    const from =
      cache.current && cache.current.cursor <= cursor ? cache.current : undefined
    const next = seek(timeline, cursor, from)
    cache.current = { state: next, cursor }
    return next
  }, [timeline, cursor])

  const atEnd = total > 0 && cursor >= total

  useEffect(() => {
    if (atEnd && playing) setPlaying(false)
  }, [atEnd, playing])

  useEffect(() => {
    if (!playing || !timeline) return

    let raf = 0
    let last = performance.now()
    let carry = 0

    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000) // clamp after a tab switch
      last = now
      carry += dt * eventsPerSecond

      if (carry >= 1) {
        const steps = Math.floor(carry)
        carry -= steps
        setCursor((c) => Math.min(c + steps, timeline.events.length))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, timeline, eventsPerSecond])

  const play = useCallback(() => {
    setCursor((c) => (timeline && c >= timeline.events.length ? 0 : c))
    setPlaying(true)
  }, [timeline])

  const pause = useCallback(() => setPlaying(false), [])

  const toggle = useCallback(() => {
    if (playing) setPlaying(false)
    else play()
  }, [playing, play])

  const stepForward = useCallback(() => {
    setPlaying(false)
    setCursor((c) => Math.min(c + 1, total))
  }, [total])

  const stepBackward = useCallback(() => {
    setPlaying(false)
    setCursor((c) => Math.max(0, c - 1))
  }, [])

  const scrub = useCallback(
    (next: number) => {
      setPlaying(false)
      setCursor(Math.max(0, Math.min(next, total)))
    },
    [total],
  )

  const restart = useCallback(() => {
    setPlaying(false)
    setCursor(0)
  }, [])

  const finish = useCallback(() => {
    setPlaying(false)
    setCursor(total)
  }, [total])

  return {
    state,
    cursor,
    total,
    playing,
    speed,
    eventsPerSecond,
    atEnd,
    play,
    pause,
    toggle,
    stepForward,
    stepBackward,
    scrub,
    restart,
    finish,
    setSpeed,
  }
}

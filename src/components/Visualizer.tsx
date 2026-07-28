import { useEffect, useMemo, useState } from 'react'
import type { AnyDataStructure, Counters } from '../core/types'
import { arrayAccesses } from '../core/types'
import { algorithmById, byCategory } from '../structures/registry'
import { buildTimeline } from '../core/player'
import { usePlayer } from '../core/usePlayer'
import { compact, duration, full, seriesColor } from '../lib/format'

interface Props {
  structure: AnyDataStructure
}

export function Visualizer({ structure }: Props) {
  const groups = byCategory(structure)

  const [algoId, setAlgoId] = useState(structure.algorithms[0].id)
  const [n, setN] = useState(structure.defaultN)
  const [shapeId, setShapeId] = useState(structure.shapes[0].id)
  const [seed, setSeed] = useState(1)

  // Switching structures invalidates the algorithm and size choices.
  useEffect(() => {
    setAlgoId(structure.algorithms[0].id)
    setN(structure.defaultN)
    setShapeId(structure.shapes[0].id)
  }, [structure])

  const spec = useMemo(() => {
    const exists = structure.algorithms.some((a) => a.id === algoId)
    return algorithmById(structure, exists ? algoId : structure.algorithms[0].id)
  }, [structure, algoId])

  const input = useMemo(
    () =>
      structure.makeInput({
        n,
        shapeId,
        seed,
        trial: 0,
        requiresSortedInput: spec.requiresSortedInput,
      }),
    [structure, spec, n, shapeId, seed],
  )

  const timeline = useMemo(
    () => buildTimeline(structure, spec, input),
    [structure, spec, input],
  )

  const player = usePlayer(timeline)
  const { state } = player

  // Space toggles playback, arrows step. Skipped while a control has focus so
  // Space still activates buttons and arrows still move sliders.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        player.toggle()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        player.stepForward()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        player.stepBackward()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  if (!state) return null

  const remaining = (player.total - player.cursor) / player.eventsPerSecond
  const shapeLocked = spec.requiresSortedInput
  const activeShape = shapeLocked
    ? (structure.shapes.find((s) => s.id === 'sorted') ?? structure.shapes[0])
    : (structure.shapes.find((s) => s.id === shapeId) ?? structure.shapes[0])
  const inputCaption = structure.describeInput?.(input) ?? null
  const secondaryStat = spec.secondaryStat ?? {
    label: 'Swaps',
    value: (c: Counters) => c.swaps,
  }

  const View = structure.View
  const Legend = structure.Legend

  return (
    <div className="layout">
      <div>
        <div className="card">
          {groups.map((group) => (
            <div className="picker-group" key={group.category.id}>
              <div className="picker-group-head">
                <h3>{group.category.name}</h3>
                <span className="picker-group-hint">{group.category.blurb}</span>
              </div>
              <div className="picker" role="group" aria-label={group.category.name}>
                {group.algorithms.map((a) => (
                  <button
                    key={a.id}
                    className="chip"
                    aria-pressed={a.id === spec.id}
                    onClick={() => setAlgoId(a.id)}
                  >
                    <span
                      className="swatch"
                      style={{ background: seriesColor(a.colorSlot) }}
                    />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="sub" style={{ margin: '16px 0 0' }}>
            {spec.blurb}
          </p>
        </div>

        <div className="card">
          <View state={state} cursor={player.cursor} />

          <div className="step-note">
            {state.note || (player.cursor === 0 ? 'Press Play to begin.' : ' ')}
          </div>

          <Legend />
        </div>

        <div className="card">
          <div className="button-row" style={{ marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={player.toggle}
              disabled={player.total === 0}
            >
              {player.playing ? 'Pause' : player.atEnd ? 'Replay' : 'Play'}
            </button>
            <button className="btn" onClick={player.stepBackward} disabled={player.cursor === 0}>
              ‹ Step
            </button>
            <button className="btn" onClick={player.stepForward} disabled={player.atEnd}>
              Step ›
            </button>
            <button className="btn" onClick={player.restart} disabled={player.cursor === 0}>
              Restart
            </button>
            <button className="btn" onClick={player.finish} disabled={player.atEnd}>
              Skip to end
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              step {player.cursor.toLocaleString()} / {player.total.toLocaleString()}
              {player.playing && ` · ~${duration(remaining)} left`}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(1, player.total)}
            value={player.cursor}
            onChange={(e) => player.scrub(Number(e.target.value))}
            aria-label="Scrub through steps"
            style={{ width: '100%' }}
          />

          <div className="control-row" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="size">
                Items <span className="value">{n}</span>
              </label>
              <input
                id="size"
                type="range"
                min={structure.minN}
                max={structure.maxN}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="speed">
                Speed <span className="value">{compact(player.eventsPerSecond)} steps/s</span>
              </label>
              <input
                id="speed"
                type="range"
                min={1}
                max={100}
                value={player.speed}
                onChange={(e) => player.setSpeed(Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="shape">Input shape</label>
              <select
                id="shape"
                // Search runs always use sorted input, so show that rather than
                // leaving a stale value next to a visibly ordered array.
                value={activeShape.id}
                onChange={(e) => setShapeId(e.target.value)}
                disabled={shapeLocked}
                title={shapeLocked ? 'This algorithm requires ordered input.' : undefined}
              >
                {structure.shapes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn" onClick={() => setSeed((s) => s + 1)}>
              Shuffle
            </button>
          </div>

          {/* The shape hints describe what a shape does to a *sort*, so they are
              actively misleading next to a search. Locked-shape algorithms get
              their own copy instead. The input caption (e.g. a search target or
              a pattern string) is relevant either way, so it's shown in both
              branches rather than only the locked one. */}
          <div className="note">
            {inputCaption && <strong>{inputCaption} — </strong>}
            {shapeLocked ? (
              <>
                this algorithm requires ordered input, so the input shape is fixed to sorted.
                Shuffle picks a new target, sometimes one that is not present.
              </>
            ) : (
              <>
                <strong>{activeShape.label}:</strong> {activeShape.hint}
              </>
            )}
          </div>
        </div>
      </div>

      <aside>
        <div className="card">
          <h3>This run</h3>
          <div className="counters">
            <div className="counter">
              <div className="k">Comparisons</div>
              <div className="v">{full(state.counters.comparisons)}</div>
            </div>
            <div className="counter">
              <div className="k">{secondaryStat.label}</div>
              <div className="v">{full(secondaryStat.value(state.counters))}</div>
            </div>
            <div className="counter">
              <div className="k">Accesses</div>
              <div className="v">{full(arrayAccesses(state.counters))}</div>
            </div>
            <div className="counter">
              <div className="k">Total for run</div>
              <div className="v">{compact(timeline.totalCounters.comparisons)}</div>
            </div>
          </div>
          <p className="sub" style={{ margin: '10px 0 0', fontSize: 12 }}>
            Counters tick up as the animation plays. &ldquo;Total for run&rdquo; is the comparison
            count for the whole run at n&nbsp;=&nbsp;{n}.
          </p>
        </div>

        <div className="card">
          <h3>Complexity</h3>
          <dl className="complexity-grid">
            <dt>Best</dt>
            <dd>{spec.complexity.best}</dd>
            <dt>Average</dt>
            <dd>{spec.complexity.average}</dd>
            <dt>Worst</dt>
            <dd>{spec.complexity.worst}</dd>
            <dt>Space</dt>
            <dd>{spec.complexity.space}</dd>
          </dl>
          <p className="sub" style={{ margin: '14px 0 0', fontSize: 12 }}>
            These are the textbook figures. The Complexity Lab tab measures what actually happens.
          </p>
        </div>

        <div className="card">
          <h3>Keyboard</h3>
          <dl className="complexity-grid">
            <dt>Space</dt>
            <dd>play / pause</dd>
            <dt>&larr; &rarr;</dt>
            <dd>step one event</dd>
          </dl>
        </div>
      </aside>
    </div>
  )
}

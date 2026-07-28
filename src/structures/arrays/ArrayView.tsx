import type { ArrayState, Region } from './model'
import { roleAt } from './model'

interface RowProps {
  state: ArrayState
  region: Region
  label: string
}

/**
 * Heights are scaled against the max of the values present, which does not
 * change during a sort, so bars never rescale mid-run — the picture stays
 * comparable frame to frame.
 */
function BarRow({ state, region, label }: RowProps) {
  const values = region === 'aux' ? state.aux : state.array
  if (!values) return null

  const max = Math.max(1, ...values)
  const n = values.length

  return (
    <div>
      <div className="bar-caption">
        <span className="label">{label}</span>
        <span className="label">{n} items</span>
      </div>
      <div
        className={region === 'aux' ? 'bars aux' : 'bars'}
        role="img"
        aria-label={`${label}: ${n} values${
          region === 'main'
            ? `, ${state.sorted.filter(Boolean).length} in final position`
            : ''
        }`}
      >
        {values.map((v, i) => (
          <div
            key={i}
            className="bar"
            data-role={roleAt(state, i, region)}
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The array structure's renderer: the main row, plus the merge buffer whenever
 * an algorithm declares one.
 *
 * Takes a `cursor` prop it never reads. The player mutates and returns the same
 * state object on the forward path, so `cursor` is what actually differs
 * between frames — without it, memoising this component would freeze the
 * animation. See the note in `core/usePlayer`.
 */
export function ArrayView({ state }: { state: ArrayState; cursor: number }) {
  const searching = state.probe !== null || state.found !== null || state.exhausted

  return (
    <>
      <BarRow state={state} region="main" label={searching ? 'Array (sorted)' : 'Array'} />
      {state.aux && <BarRow state={state} region="aux" label="Merge buffer" />}
    </>
  )
}

const LEGEND: Array<{ role: string; label: string; varName: string }> = [
  { role: 'idle', label: 'Unsorted', varName: '--bar-idle' },
  { role: 'comparing', label: 'Comparing', varName: '--bar-comparing' },
  { role: 'swapping', label: 'Swap / write', varName: '--bar-active' },
  { role: 'pivot', label: 'Pivot / probe', varName: '--bar-pivot' },
  { role: 'reading', label: 'Reading', varName: '--bar-reading' },
  { role: 'sorted', label: 'In final position', varName: '--bar-sorted' },
  { role: 'out-of-range', label: 'Outside active range', varName: '--bar-out' },
]

/** Colour never carries meaning alone — this legend is always rendered. */
export function BarLegend() {
  return (
    <div className="legend">
      {LEGEND.map((item) => (
        <span className="legend-item" key={item.role}>
          <span className="swatch" style={{ background: `var(${item.varName})` }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

import type { StringState } from './model'
import { patternCellRole, textCellRole } from './model'

/**
 * The strings structure's renderer.
 *
 * Unlike arrays' bars, a character has no magnitude to encode as height — so
 * this is an identity grid: one fixed-size cell per character, coloured by
 * role. The pattern row is padded to the text's full length with invisible
 * spacer cells so both rows share one flex layout and the pattern lines up
 * under its current alignment without any manual offset math.
 *
 * Takes a `cursor` prop it never reads, for the same reason ArrayView does —
 * see the note in `core/usePlayer` about the state object being mutated in
 * place on the forward path.
 */
export function StringView({ state }: { state: StringState; cursor: number }) {
  const text = [...state.text]
  const pattern = [...state.pattern]
  const m = pattern.length

  return (
    <>
      <div className="bar-caption">
        <span className="label">Text</span>
        <span className="label">{text.length} characters</span>
      </div>
      <div className="cells-scroll">
        <div className="cells" role="img" aria-label={`Text: ${state.text}`}>
          {text.map((ch, i) => (
            <div key={i} className="cell" data-role={textCellRole(state, i)}>
              {ch}
            </div>
          ))}
        </div>

        <div
          className="cells"
          role="img"
          aria-label={`Pattern "${state.pattern}", currently aligned at index ${state.windowStart}`}
        >
          {text.map((_, i) => {
            const j = i - state.windowStart
            if (j < 0 || j >= m) return <div key={i} className="cell cell-empty" />
            return (
              <div key={i} className="cell" data-role={patternCellRole(state, j)}>
                {pattern[j]}
              </div>
            )
          })}
        </div>

        {state.lps && (
          <div className="cells cells-lps" role="img" aria-label="KMP failure table (LPS)">
            {text.map((_, i) => {
              const j = i - state.windowStart
              if (j < 0 || j >= m) return <div key={i} className="cell cell-empty" />
              return (
                <div
                  key={i}
                  className="cell cell-lps"
                  data-role={state.lpsLookupIndex === j ? 'comparing' : 'idle'}
                >
                  {state.lps![j]}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="string-summary">
        <span>
          Window start <strong>{state.windowStart}</strong>
        </span>
        <span>
          Matched so far <strong>{state.matchedCount}</strong> / {m}
        </span>
        <span>
          Matches found <strong>{state.matches.length}</strong>
        </span>
      </div>
    </>
  )
}

const LEGEND: Array<{ role: string; label: string; varName: string }> = [
  { role: 'idle', label: 'Not yet reached', varName: '--bar-idle' },
  { role: 'window', label: 'Current alignment', varName: '--bar-reading' },
  { role: 'comparing', label: 'Comparing', varName: '--bar-comparing' },
  { role: 'match', label: 'Matching so far', varName: '--bar-sorted' },
  { role: 'mismatch', label: 'Mismatch', varName: '--bar-mismatch' },
  { role: 'hash-checking', label: 'Hash check (Rabin-Karp)', varName: '--bar-pivot' },
  { role: 'skip', label: 'Skipped (KMP)', varName: '--bar-out' },
  { role: 'found', label: 'Confirmed match', varName: '--bar-found' },
]

export function StringLegend() {
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

import { useEffect, useRef, useState } from 'react'
import type { AnyAlgorithmSpec, AnyDataStructure } from '../core/types'
import type { ComplexitySeries, Metric } from '../core/complexity'
import { classifyRatio, growthRatios, runSweep, sizeLadder } from '../core/complexity'
import { byCategory } from '../structures/registry'
import { full, seriesColor } from '../lib/format'
import { GrowthChart } from './GrowthChart'

const MAX_N_OPTIONS = [256, 512, 1024, 2048, 4096]

interface Props {
  structure: AnyDataStructure
}

export function ComplexityLab({ structure }: Props) {
  const groups = byCategory(structure)

  // Default to the first category — comparing a sort against a search is a
  // scale mismatch, not a comparison.
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    (groups[0]?.algorithms ?? []).map((a) => a.id),
  )
  const [maxN, setMaxN] = useState(1024)
  const [shapeId, setShapeId] = useState(structure.shapes[0].id)
  const [metric, setMetric] = useState<Metric>('comparisons')
  const [logScale, setLogScale] = useState(false)
  const [showModels, setShowModels] = useState(true)

  const [series, setSeries] = useState<ComplexitySeries[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setSelectedIds((byCategory(structure)[0]?.algorithms ?? []).map((a) => a.id))
    setShapeId(structure.shapes[0].id)
  }, [structure])

  // Preserves registry order regardless of the order chips were clicked, so a
  // series never changes colour when the selection changes.
  const specs: AnyAlgorithmSpec[] = structure.algorithms.filter((a: AnyAlgorithmSpec) =>
    selectedIds.includes(a.id),
  )

  /** Invalidates in-flight sweeps when the inputs change underneath them. */
  const runToken = useRef(0)

  useEffect(() => {
    const token = ++runToken.current
    if (specs.length === 0) {
      setSeries([])
      return
    }

    setRunning(true)
    setProgress(0)

    runSweep(structure, specs, maxN, shapeId, 12345, (done, total) => {
      if (runToken.current === token) setProgress(done / total)
    }).then((result) => {
      if (runToken.current !== token) return
      setSeries(result)
      setRunning(false)
    })

    return () => {
      runToken.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, selectedIds.join(','), maxN, shapeId])

  const sizes = sizeLadder(maxN)
  const heavy = maxN >= 2048 && specs.some((s) => s.expectedGrowth === 'n²')
  const mixedCategories = new Set(specs.map((s) => s.categoryId)).size > 1

  const toggle = (id: string) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )

  return (
    <>
      <div className="card">
        <h2>Complexity Lab — {structure.name}</h2>
        <p className="sub">
          The same algorithms, run without any animation, at sizes that double each step. Watch
          what happens to the work when the input doubles — that ratio <em>is</em> the complexity
          class.
        </p>

        {groups.map((group) => (
          <div className="picker-group" key={group.category.id}>
            <div className="picker-group-head">
              <h3>{group.category.name}</h3>
            </div>
            <div className="picker" role="group" aria-label={`${group.category.name} algorithms`}>
              {group.algorithms.map((a) => (
                <button
                  key={a.id}
                  className="chip"
                  aria-pressed={selectedIds.includes(a.id)}
                  onClick={() => toggle(a.id)}
                >
                  <span className="swatch" style={{ background: seriesColor(a.colorSlot) }} />
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="control-row" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="maxn">Largest n</label>
            <select id="maxn" value={maxN} onChange={(e) => setMaxN(Number(e.target.value))}>
              {MAX_N_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="lab-shape">Input shape</label>
            <select
              id="lab-shape"
              value={shapeId}
              onChange={(e) => setShapeId(e.target.value)}
            >
              {structure.shapes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="metric">Measure</label>
            <select
              id="metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
            >
              <option value="comparisons">Comparisons</option>
              <option value="accesses">Array accesses</option>
            </select>
          </div>

          <button className="btn" aria-pressed={logScale} onClick={() => setLogScale((v) => !v)}>
            {logScale ? 'Log scale ✓' : 'Log scale'}
          </button>

          <button
            className="btn"
            aria-pressed={showModels}
            onClick={() => setShowModels((v) => !v)}
          >
            {showModels ? 'Theory overlay ✓' : 'Theory overlay'}
          </button>
        </div>

        {running && (
          <div style={{ marginTop: 16 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p className="sub" style={{ margin: '6px 0 0', fontSize: 12 }}>
              Measuring… {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        {heavy && (
          <div className="note">
            <strong>Heads up:</strong> a quadratic algorithm at n&nbsp;=&nbsp;
            {maxN.toLocaleString()} is millions of comparisons, so this sweep takes a few seconds.
            That slowness is the point.
          </div>
        )}

        {mixedCategories && (
          <div className="note">
            <strong>Mixed categories:</strong> you are comparing across{' '}
            {[...new Set(specs.map((s) => s.categoryId))].join(' and ')}. The scales differ by
            orders of magnitude — turn on <strong>Log scale</strong> or the smaller one will read
            as a flat line on the floor.
          </div>
        )}

        {specs.length === 0 && (
          <div className="note">Select at least one algorithm to measure.</div>
        )}
      </div>

      {series.length > 0 && specs.length > 0 && (
        <>
          <div className="card">
            <h3>{metric === 'comparisons' ? 'Comparisons' : 'Array accesses'} vs input size</h3>
            <GrowthChart
              series={series}
              specs={specs}
              metric={metric}
              logScale={logScale}
              showModels={showModels}
            />
            <div className="legend">
              {specs.map((s) => (
                <span className="legend-item" key={s.id}>
                  <span className="swatch" style={{ background: seriesColor(s.colorSlot) }} />
                  {s.name} — measured
                </span>
              ))}
              {showModels && (
                <span className="legend-item">
                  <span
                    className="swatch"
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, var(--text-muted) 0 3px, transparent 3px 5px)',
                    }}
                  />
                  Dashed — theoretical curve, scaled to fit
                </span>
              )}
            </div>
            <p className="sub" style={{ margin: '12px 0 0', fontSize: 12 }}>
              Big-O throws away constant factors, so a raw n² curve would be meaningless next to
              real counts. Each dashed curve is anchored to its algorithm&rsquo;s largest measured
              point — what matters is whether the measured line has the same <em>shape</em>.
            </p>
          </div>

          <div className="card">
            <h3>When n doubles, work multiplies by…</h3>
            <div className="table-scroll">
              <table>
                <caption className="visually-hidden">
                  {metric === 'comparisons' ? 'Comparisons' : 'Array accesses'} at each input size,
                  with the ratio against the previous row.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">n</th>
                    {specs.map((s) => (
                      <th scope="col" key={s.id}>
                        <span className="algo-tag">
                          <span
                            className="swatch"
                            style={{ background: seriesColor(s.colorSlot) }}
                          />
                          {s.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((v, rowIdx) => (
                    <tr key={v}>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 550 }}>
                        {v.toLocaleString()}
                      </th>
                      {specs.map((s, si) => {
                        const pts = series[si]?.points ?? []
                        const p = pts[rowIdx]
                        const ratio = growthRatios(pts, metric)[rowIdx]
                        if (!p) return <td key={s.id}>—</td>
                        return (
                          <td key={s.id}>
                            {full(metric === 'comparisons' ? p.comparisons : p.accesses)}
                            {ratio !== null && (
                              <span className="ratio"> &nbsp;{ratio.toFixed(2)}×</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', fontWeight: 550 }}>
                      Reads as
                    </th>
                    {specs.map((s, si) => {
                      const pts = series[si]?.points ?? []
                      const ratios = growthRatios(pts, metric)
                      const last = pts.length - 1
                      return (
                        <td key={s.id} style={{ color: 'var(--text-secondary)' }}>
                          {classifyRatio(ratios[last] ?? null, pts[last - 1]?.n, pts[last]?.n)}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ margin: '14px 0 0', fontSize: 12 }}>
              A ratio near 4 means quadratic and a ratio near 1 means logarithmic — doubling the
              haystack costs binary search one extra comparison. Linear and n&nbsp;log&nbsp;n are
              genuinely hard to tell apart down here: at n&nbsp;=&nbsp;1,024 linear doubles by
              exactly 2.00 and n&nbsp;log&nbsp;n by 2.22. &ldquo;Reads as&rdquo; compares each
              measured ratio against what every model would actually predict between those two
              sizes, and names the closest.
            </p>
          </div>

          {structure.id === 'arrays' && (
            <div className="card">
              <h3>Try this</h3>
              <ul
                style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13 }}
              >
                <li>
                  Set <strong>Input shape</strong> to <strong>Sorted</strong>. Bubble sort collapses
                  to linear because of its early exit — and quick sort blows up to quadratic,
                  because a last-element pivot is the worst possible choice on ordered data.
                </li>
                <li>
                  Set it to <strong>Reversed</strong>. Now bubble sort is at its worst and merge
                  sort has not moved at all — its cost does not depend on the input at all.
                </li>
                <li>
                  Add <strong>Binary Search</strong> and turn on <strong>Log scale</strong>. On a
                  linear axis it is a flat line on the floor; you need a log axis to even see that
                  it is growing.
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}

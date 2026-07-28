import { useMemo, useState } from 'react'
import type { AnyAlgorithmSpec } from '../core/types'
import type { ComplexitySeries, Metric } from '../core/complexity'
import { fitCurve } from '../core/complexity'
import { compact, full, seriesColor } from '../lib/format'

interface Props {
  series: ComplexitySeries[]
  specs: AnyAlgorithmSpec[]
  metric: Metric
  logScale: boolean
  showModels: boolean
}

const W = 760
const H = 380
const M = { top: 18, right: 104, bottom: 46, left: 68 }
const PLOT_W = W - M.left - M.right
const PLOT_H = H - M.top - M.bottom

/**
 * Nice round ticks for a linear axis.
 *
 * The top tick must sit at or ABOVE the data max — it becomes the axis
 * maximum, so stopping at the last round number below the max would clip the
 * tallest series off the top of the plot.
 */
function linearTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const steps = Math.ceil(max / step)
  // Index-multiplied rather than accumulated, to keep ticks exactly round.
  return Array.from({ length: steps + 1 }, (_, i) => i * step)
}

function decadeTicks(min: number, max: number): number[] {
  const out: number[] = []
  const lo = Math.floor(Math.log10(Math.max(min, 1e-6)))
  const hi = Math.ceil(Math.log10(Math.max(max, 10)))
  for (let e = lo; e <= hi; e++) out.push(Math.pow(10, e))
  return out
}

export function GrowthChart({ series, specs, metric, logScale, showModels }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const sizes = series[0]?.points.map((p) => p.n) ?? []
  const valueOf = (p: { comparisons: number; accesses: number }) =>
    metric === 'comparisons' ? p.comparisons : p.accesses

  const { yMin, yMax, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.points.map(valueOf)).filter((v) => v > 0)
    const max = all.length ? Math.max(...all) : 1
    const min = all.length ? Math.min(...all) : 1
    if (logScale) {
      const lo = Math.pow(10, Math.floor(Math.log10(min)))
      const hi = Math.pow(10, Math.ceil(Math.log10(max)))
      return { yMin: lo, yMax: hi, ticks: decadeTicks(lo, hi) }
    }
    const t = linearTicks(max)
    return { yMin: 0, yMax: t[t.length - 1] || 1, ticks: t }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, metric, logScale])

  if (sizes.length === 0) return null

  // Sizes double, so equal spacing per step IS a log-x axis — and it keeps the
  // chart aligned with the doubling table underneath it.
  const x = (i: number) =>
    M.left + (sizes.length === 1 ? PLOT_W / 2 : (i / (sizes.length - 1)) * PLOT_W)

  const y = (v: number) => {
    if (logScale) {
      const lv = Math.log10(Math.max(v, yMin))
      const lo = Math.log10(yMin)
      const hi = Math.log10(yMax)
      return M.top + PLOT_H - ((lv - lo) / (hi - lo)) * PLOT_H
    }
    return M.top + PLOT_H - (v / yMax) * PLOT_H
  }

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  // Direct labels for the line ends, nudged apart so they never collide.
  const labels = specs
    .map((spec, si) => {
      const pts = series[si]?.points ?? []
      const last = pts[pts.length - 1]
      return last ? { spec, y: y(valueOf(last)), text: spec.name } : null
    })
    .filter((l): l is { spec: AnyAlgorithmSpec; y: number; text: string } => l !== null)
    .sort((a, b) => a.y - b.y)

  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15
  }

  const hoverX = hover !== null ? x(hover) : 0

  return (
    <div className="chart-holder">
      <div className="chart-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${metric} versus input size for ${specs.map((s) => s.name).join(', ')}. The table below carries the same numbers.`}
        >
          <g className="chart-grid">
            {ticks.map((t) => (
              <line key={t} x1={M.left} x2={M.left + PLOT_W} y1={y(t)} y2={y(t)} />
            ))}
          </g>

          {ticks.map((t) => (
            <text
              key={t}
              className="chart-label"
              x={M.left - 9}
              y={y(t) + 3.5}
              textAnchor="end"
            >
              {compact(t)}
            </text>
          ))}

          {sizes.map((n, i) => (
            <text
              key={n}
              className="chart-label"
              x={x(i)}
              y={M.top + PLOT_H + 18}
              textAnchor="middle"
            >
              {n}
            </text>
          ))}

          <g className="chart-axis">
            <line
              x1={M.left}
              x2={M.left + PLOT_W}
              y1={M.top + PLOT_H}
              y2={M.top + PLOT_H}
            />
          </g>

          <text
            className="chart-axis-title"
            x={M.left + PLOT_W / 2}
            y={H - 8}
            textAnchor="middle"
          >
            Input size (n)
          </text>
          <text
            className="chart-axis-title"
            transform={`translate(14, ${M.top + PLOT_H / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {metric === 'comparisons' ? 'Comparisons' : 'Array accesses'}
            {logScale ? ' (log)' : ''}
          </text>

          {/* Theoretical curves sit under the measured lines so real data wins. */}
          {showModels &&
            specs.map((spec, si) => {
              const pts = series[si]?.points ?? []
              if (pts.length === 0) return null
              const f = fitCurve(pts, spec.expectedGrowth, metric)
              return (
                <path
                  key={`m-${spec.id}`}
                  className="model-line"
                  d={path(sizes.map(f))}
                  stroke={seriesColor(spec.colorSlot)}
                  opacity={0.5}
                />
              )
            })}

          {specs.map((spec, si) => {
            const pts = series[si]?.points ?? []
            if (pts.length === 0) return null
            return (
              <path
                key={spec.id}
                className="series-line"
                d={path(pts.map(valueOf))}
                stroke={seriesColor(spec.colorSlot)}
              />
            )
          })}

          {specs.map((spec, si) => {
            const pts = series[si]?.points ?? []
            return pts.map((p, i) => (
              <circle
                key={`${spec.id}-${i}`}
                className="series-dot"
                cx={x(i)}
                cy={y(valueOf(p))}
                r={hover === i ? 5 : 3.5}
                fill={seriesColor(spec.colorSlot)}
              />
            ))
          })}

          {labels.map((l) => (
            <text
              key={l.spec.id}
              x={M.left + PLOT_W + 10}
              y={l.y + 3.5}
              className="chart-label"
              style={{ fill: seriesColor(l.spec.colorSlot), fontWeight: 600 }}
            >
              {l.text}
            </text>
          ))}

          {hover !== null && (
            <line
              className="crosshair"
              x1={hoverX}
              x2={hoverX}
              y1={M.top}
              y2={M.top + PLOT_H}
            />
          )}

          {/* Hit targets are the full column height — much bigger than the dots. */}
          {sizes.map((n, i) => {
            const band = PLOT_W / Math.max(1, sizes.length - 1)
            return (
              <rect
                key={`hit-${n}`}
                className="hover-band"
                x={x(i) - band / 2}
                y={M.top}
                width={band}
                height={PLOT_H}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </svg>
      </div>

      {hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `calc(${(hoverX / W) * 100}% + ${hoverX > W / 2 ? -170 : 14}px)`,
            top: 26,
          }}
        >
          <div className="tt-head">n = {sizes[hover]}</div>
          {specs.map((spec, si) => {
            const p = series[si]?.points[hover]
            if (!p) return null
            return (
              <div className="tt-row" key={spec.id}>
                <span
                  className="swatch"
                  style={{ background: seriesColor(spec.colorSlot) }}
                />
                {spec.name}
                <span className="n">{full(valueOf(p))}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

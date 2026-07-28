export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(1)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
}

export function full(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

/** Categorical slots are 1-indexed and assigned in fixed order — never cycled. */
export function seriesColor(slot: number): string {
  return `var(--series-${slot})`
}

export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const m = Math.floor(seconds / 60)
  return `${m}m ${Math.round(seconds - m * 60)}s`
}

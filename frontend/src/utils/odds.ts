// Display-only conversion between calibrated probabilities and decimal odds.
// Never used for stakes or money — purely a reading format (see audit P1).
export function probToDecimal(p: number): number | null {
  if (!Number.isFinite(p) || p <= 0) return null
  return 1 / p
}

const MAX_DECIMAL = 999

export function formatDecimal(p: number): string {
  const d = probToDecimal(p)
  if (d === null) return '—'
  return `${Math.min(d, MAX_DECIMAL).toFixed(2)}`
}

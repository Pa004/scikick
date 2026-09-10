import { useTheme } from '../../theme/theme-context'
import { useAccent } from '../../theme/accent'

export interface ChartTheme {
  grid: string
  tick: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  accent: string
  accentDot: string
  reference: string
}

const FALLBACK: ChartTheme = {
  grid: '#d9e0ec',
  tick: '#4c5a75',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d9e0ec',
  tooltipText: '#0d1526',
  accent: '#0d74ce',
  accentDot: '#0d74ce',
  reference: '#ce2c31',
}

function readVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

// Resolves live theme tokens so charts follow any accent switch.
// Recharts receives computed strings (SVG attributes ignore var()).
export function useChartTheme(): ChartTheme {
  useTheme()
  useAccent()
  return {
    grid: readVar('--border', FALLBACK.grid),
    tick: readVar('--muted', FALLBACK.tick),
    tooltipBg: readVar('--surface', FALLBACK.tooltipBg),
    tooltipBorder: readVar('--border', FALLBACK.tooltipBorder),
    tooltipText: readVar('--foreground', FALLBACK.tooltipText),
    accent: readVar('--primary-strong', FALLBACK.accent),
    accentDot: readVar('--primary-strong', FALLBACK.accentDot),
    reference: readVar('--danger', FALLBACK.reference),
  }
}

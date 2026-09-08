import { useTheme } from '../../theme/theme-context'

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

const LIGHT: ChartTheme = {
  grid: '#d9e0ec',
  tick: '#4c5a75',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d9e0ec',
  tooltipText: '#0d1526',
  accent: '#65a30d',
  accentDot: '#4d7c0f',
  reference: '#b91c1c',
}

const DARK: ChartTheme = {
  grid: '#28324f',
  tick: '#a3b0c7',
  tooltipBg: '#111832',
  tooltipBorder: '#28324f',
  tooltipText: '#e8edf7',
  accent: '#a3e635',
  accentDot: '#bef264',
  reference: '#f87171',
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  return theme === 'dark' ? DARK : LIGHT
}

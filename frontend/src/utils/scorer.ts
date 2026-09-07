import type { ScorerPlayer } from '../types'

export type ScorerSortKey = 'prob_anytime' | 'xg90' | 'min_expected' | 'name' | 'team'
export type SortDir = 'asc' | 'desc'
export type TeamFilter = 'both' | 'home' | 'away'

export const DEFAULT_SORT_DIR: Record<ScorerSortKey, SortDir> = {
  prob_anytime: 'desc',
  xg90: 'desc',
  min_expected: 'desc',
  name: 'asc',
  team: 'asc',
}

// Players with unexpected home_away values only surface under 'both'.
export function filterScorers(scorers: ScorerPlayer[], team: TeamFilter, query: string): ScorerPlayer[] {
  const q = query.trim().toLowerCase()
  return scorers.filter(s => {
    if (team !== 'both' && s.home_away !== team) return false
    if (!q) return true
    return `${s.name} ${s.team}`.toLowerCase().includes(q)
  })
}

export function sortScorers(scorers: ScorerPlayer[], key: ScorerSortKey, dir: SortDir): ScorerPlayer[] {
  const sign = dir === 'asc' ? 1 : -1
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : -Infinity)
  return [...scorers].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    const cmp = typeof av === 'string' && typeof bv === 'string'
      ? av.localeCompare(bv)
      : num(av) - num(bv)
    if (cmp !== 0 && !Number.isNaN(cmp)) return cmp * sign
    return num(b.prob_anytime) - num(a.prob_anytime)
  })
}

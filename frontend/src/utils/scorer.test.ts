import { describe, it, expect } from 'vitest'
import type { ScorerPlayer } from '../types'
import { filterScorers, sortScorers, DEFAULT_SORT_DIR } from './scorer'

function player(over: Partial<ScorerPlayer> & { name: string }): ScorerPlayer {
  return {
    player_id: 1, team: 'Arsenal', position: 'FWD', xg90: 0.5,
    min_expected: 80, prob_anytime: 0.3, home_away: 'home', ...over,
  }
}

const squad = [
  player({ player_id: 1, name: 'Zeta', team: 'Chelsea', xg90: 0.2, min_expected: 60, prob_anytime: 0.1, home_away: 'away' }),
  player({ player_id: 2, name: 'Alpha', team: 'Arsenal', xg90: 0.7, min_expected: 90, prob_anytime: 0.4, home_away: 'home' }),
  player({ player_id: 3, name: 'Mike', team: 'Arsenal', xg90: 0.4, min_expected: 70, prob_anytime: 0.4, home_away: 'home' }),
  player({ player_id: 4, name: 'Odd', team: 'X', xg90: 0.1, min_expected: 20, prob_anytime: 0.05, home_away: 'bench' }),
]

describe('DEFAULT_SORT_DIR', () => {
  it('sorts numbers desc and text asc by default', () => {
    expect(DEFAULT_SORT_DIR.prob_anytime).toBe('desc')
    expect(DEFAULT_SORT_DIR.name).toBe('asc')
  })
})

describe('sortScorers', () => {
  it('sorts numerics desc with prob tiebreak', () => {
    const sorted = sortScorers(squad, 'prob_anytime', 'desc')
    expect(sorted.map(s => s.name)).toEqual(['Alpha', 'Mike', 'Zeta', 'Odd'])
  })

  it('sorts text asc', () => {
    expect(sortScorers(squad, 'name', 'asc').map(s => s.name)).toEqual(['Alpha', 'Mike', 'Odd', 'Zeta'])
  })

  it('sorts numerics asc', () => {
    expect(sortScorers(squad, 'xg90', 'asc')[0].name).toBe('Odd')
  })
})

describe('filterScorers', () => {
  it('filters by team literally', () => {
    expect(filterScorers(squad, 'home', '').map(s => s.name)).toEqual(['Alpha', 'Mike'])
    expect(filterScorers(squad, 'away', '').map(s => s.name)).toEqual(['Zeta'])
    expect(filterScorers(squad, 'both', '')).toHaveLength(4)
  })

  it('matches query case-insensitively on name and team', () => {
    expect(filterScorers(squad, 'both', 'ars').map(s => s.name)).toEqual(['Alpha', 'Mike'])
    expect(filterScorers(squad, 'both', 'ZETA').map(s => s.name)).toEqual(['Zeta'])
  })
})

import { describe, it, expect } from 'vitest'
import { displayTeam, teamMatchesQuery } from './teamNames'
import { matchesQuery } from '../components/fixtures/fixtureUtils'

describe('teamNames', () => {
  it('restores diacritics for known canonicals', () => {
    expect(displayTeam('Alaves')).toBe('Alavés')
    expect(displayTeam('Espanol')).toBe('Español')
    expect(displayTeam('Leganes')).toBe('Leganés')
  })

  it('leaves other names untouched', () => {
    expect(displayTeam('Arsenal')).toBe('Arsenal')
    expect(displayTeam("Nott'm Forest")).toBe("Nott'm Forest")
  })

  it('matches queries with or without accents', () => {
    expect(teamMatchesQuery('Alaves', 'alaves')).toBe(true)
    expect(teamMatchesQuery('Alaves', 'alavés')).toBe(true)
    expect(teamMatchesQuery('Alaves', 'laves')).toBe(true)
    expect(teamMatchesQuery('Arsenal', 'alaves')).toBe(false)
    expect(teamMatchesQuery('Arsenal', '')).toBe(true)
  })
})

describe('matchesQuery', () => {
  const f = {
    id: 1, date: '2026-09-12', home: 'Alaves', away: 'Valencia',
    status: 'pre', home_score: null, away_score: null, prediction: null, league: 'SP1',
  }
  it('matches across both teams without accents', () => {
    expect(matchesQuery(f, 'alaves valencia')).toBe(true)
    expect(matchesQuery(f, 'alavés')).toBe(true)
    expect(matchesQuery(f, 'valencia alaves')).toBe(true)
  })
  it('rejects partial cross-field misses', () => {
    expect(matchesQuery(f, 'alaves madrid')).toBe(false)
    expect(matchesQuery(f, 'zzz')).toBe(false)
  })
  it('matches league codes', () => {
    expect(matchesQuery(f, 'sp1')).toBe(true)
  })
})

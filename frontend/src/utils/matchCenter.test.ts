import { describe, it, expect } from 'vitest'
import type { Fixture } from '../types'
import {
  extract1x2,
  getTeamForm,
  getHeadToHead,
  getMomentum,
  getSuperCombo,
  selectPickOfDay,
} from './matchCenter'

function fixture(over: Partial<Fixture>): Fixture {
  return {
    id: 1, date: '2025-05-01', home: 'A', away: 'B', status: 'post',
    home_score: 1, away_score: 0, prediction: null, league: 'E0', ...over,
  }
}

const probs123 = { probabilities: { home: 0.5, draw: 0.3, away: 0.2 } }

describe('extract1x2', () => {
  it('reads direct probabilities shape', () => {
    expect(extract1x2(probs123)).toEqual({ home: 0.5, draw: 0.3, away: 0.2 })
  })

  it('reads nested markets shape', () => {
    expect(extract1x2({ markets: { '1x2': { home: 0.6, draw: 0.2, away: 0.2 } } }))
      .toEqual({ home: 0.6, draw: 0.2, away: 0.2 })
  })

  it('returns null for missing or malformed data', () => {
    expect(extract1x2(null)).toBeNull()
    expect(extract1x2({ markets: {} })).toBeNull()
    expect(extract1x2({ probabilities: { home: 'x', draw: 0.3, away: 0.2 } })).toBeNull()
  })
})

describe('getTeamForm', () => {
  const fixtures = [
    fixture({ id: 1, date: '2025-05-04', home: 'A', away: 'X', home_score: 2, away_score: 0 }),
    fixture({ id: 2, date: '2025-05-03', home: 'Y', away: 'A', home_score: 1, away_score: 1 }),
    fixture({ id: 3, date: '2025-05-02', home: 'A', away: 'Z', home_score: 0, away_score: 3 }),
    fixture({ id: 4, date: '2025-05-05', home: 'A', away: 'W', status: 'pre', home_score: null, away_score: null }),
  ]

  it('returns most recent first from team perspective, ignoring pre', () => {
    expect(getTeamForm(fixtures, 'A')).toEqual(['W', 'D', 'L'])
  })

  it('respects the window size', () => {
    expect(getTeamForm(fixtures, 'A', 2)).toEqual(['W', 'D'])
  })

  it('returns empty without resolved fixtures', () => {
    expect(getTeamForm(fixtures, 'Nobody')).toEqual([])
  })
})

describe('getHeadToHead', () => {
  const fixtures = [
    fixture({ id: 1, date: '2025-04-01', home: 'A', away: 'B', home_score: 1, away_score: 0 }),
    fixture({ id: 2, date: '2025-03-01', home: 'B', away: 'A', home_score: 2, away_score: 2 }),
    fixture({ id: 3, date: '2025-02-01', home: 'B', away: 'A', home_score: 3, away_score: 1 }),
    fixture({ id: 4, date: '2025-05-01', home: 'A', away: 'C', home_score: 1, away_score: 0 }),
  ]

  it('counts both venues and draws', () => {
    const h2h = getHeadToHead('A', 'B', fixtures)
    expect(h2h.homeWins).toBe(1)
    expect(h2h.draws).toBe(1)
    expect(h2h.awayWins).toBe(1)
    expect(h2h.meetings).toHaveLength(3)
    expect(h2h.meetings[0].date).toBe('2025-04-01')
  })

  it('returns empty summary without meetings', () => {
    expect(getHeadToHead('A', 'Z', fixtures)).toEqual({ homeWins: 0, draws: 0, awayWins: 0, meetings: [] })
  })
})

describe('getMomentum', () => {
  it('computes points share over the shared window', () => {
    expect(getMomentum(['W', 'W'], ['L'])).toEqual({ homePct: 100, awayPct: 0 })
    const even = getMomentum(['W', 'D'], ['W', 'D'])
    expect(even.homePct).toBeCloseTo(66.67, 1)
    expect(even.awayPct).toBeCloseTo(66.67, 1)
  })

  it('handles empty form', () => {
    expect(getMomentum([], [])).toEqual({ homePct: 0, awayPct: 0 })
  })
})

describe('getSuperCombo', () => {
  it('picks the strongest outcome per market with independence estimate', () => {
    const combo = getSuperCombo({
      '1x2': { home: 0.5, draw: 0.3, away: 0.2 },
      'over_under_2.5': { over: 0.6, under: 0.4 },
      btts: { yes: 0.4, no: 0.6 },
    })
    expect(combo.legs).toEqual([
      { market: '1x2', outcome: 'home', prob: 0.5 },
      { market: 'over_under_2.5', outcome: 'over', prob: 0.6 },
      { market: 'btts', outcome: 'no', prob: 0.6 },
    ])
    expect(combo.estimate).toBeCloseTo(0.18)
  })

  it('omits missing markets and reports empty combo', () => {
    expect(getSuperCombo({})).toEqual({ legs: [], estimate: null })
    const partial = getSuperCombo({ btts: { yes: 0.55, no: 0.45 } })
    expect(partial.legs).toHaveLength(1)
    expect(partial.estimate).toBeCloseTo(0.55)
  })
})

describe('selectPickOfDay', () => {
  it('picks the highest confidence fixture', () => {
    const fixtures = [
      fixture({ id: 1, home: 'A', away: 'B', prediction: probs123 }),
      fixture({ id: 2, home: 'C', away: 'D', prediction: { probabilities: { home: 0.2, draw: 0.2, away: 0.6 } } }),
      fixture({ id: 3, home: 'E', away: 'F', prediction: null }),
    ]
    const pick = selectPickOfDay(fixtures)
    expect(pick?.fixtureId).toBe(2)
    expect(pick?.outcome).toBe('away')
  })

  it('breaks ties by probability gap', () => {
    const fixtures = [
      fixture({ id: 1, date: '2025-05-02', home: 'A', away: 'B', prediction: { probabilities: { home: 0.6, draw: 0.2, away: 0.2 } } }),
      fixture({ id: 2, date: '2025-05-01', home: 'C', away: 'D', prediction: { probabilities: { home: 0.6, draw: 0.3, away: 0.1 } } }),
    ]
    expect(selectPickOfDay(fixtures)?.fixtureId).toBe(1)
  })

  it('returns null without extractable predictions', () => {
    expect(selectPickOfDay([fixture({ id: 1, prediction: null })])).toBeNull()
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { clearRecentVisits, getRecentVisits, recordVisit } from './visits'

describe('visits', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records most-recent-first without duplicates', () => {
    recordVisit({ kind: 'team', id: 'Arsenal', label: 'Arsenal' })
    recordVisit({ kind: 'match', id: '1', label: 'Arsenal vs Chelsea' })
    recordVisit({ kind: 'team', id: 'Arsenal', label: 'Arsenal' })
    const visits = getRecentVisits()
    expect(visits.map(v => v.id)).toEqual(['Arsenal', '1'])
    expect(visits).toHaveLength(2)
  })

  it('caps history and survives corrupt storage', () => {
    for (let i = 0; i < 8; i++) {
      recordVisit({ kind: 'team', id: `T${i}`, label: `T${i}` })
    }
    expect(getRecentVisits()).toHaveLength(5)
    localStorage.setItem('scikick.recent-visits', 'nope')
    expect(getRecentVisits()).toEqual([])
    clearRecentVisits()
    expect(localStorage.getItem('scikick.recent-visits')).toBeNull()
  })
})

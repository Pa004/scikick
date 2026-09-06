import { describe, it, expect } from 'vitest'
import { getVerdict, formatFrequency, formatHumanDate } from './verdict'

describe('getVerdict', () => {
  it('picks the strongest outcome with its team label', () => {
    expect(getVerdict('Arsenal', 'Chelsea', { home: 0.5, draw: 0.3, away: 0.2 }))
      .toEqual({ outcome: 'home', teamLabel: 'Arsenal', prob: 0.5 })
    expect(getVerdict('Arsenal', 'Chelsea', { home: 0.2, draw: 0.3, away: 0.5 }))
      .toEqual({ outcome: 'away', teamLabel: 'Chelsea', prob: 0.5 })
  })

  it('reports draws with an empty team label', () => {
    expect(getVerdict('Arsenal', 'Chelsea', { home: 0.2, draw: 0.5, away: 0.3 }))
      .toEqual({ outcome: 'draw', teamLabel: '', prob: 0.5 })
  })

  it('breaks home/draw ties home-first like the grid favorite', () => {
    expect(getVerdict('A', 'B', { home: 0.4, draw: 0.4, away: 0.2 }).outcome).toBe('home')
  })
})

describe('formatFrequency', () => {
  it('rounds to ones of ten and clamps', () => {
    expect(formatFrequency(0.62)).toBe(6)
    expect(formatFrequency(0.65)).toBe(7)
    expect(formatFrequency(0)).toBe(0)
    expect(formatFrequency(1)).toBe(10)
    expect(formatFrequency(-0.2)).toBe(0)
    expect(formatFrequency(1.5)).toBe(10)
  })

  it('returns zero for non-finite input', () => {
    expect(formatFrequency(NaN)).toBe(0)
  })
})

describe('formatHumanDate', () => {
  const now = new Date(2025, 4, 20, 15, 0, 0)

  it('names today, tomorrow and yesterday in both locales', () => {
    expect(formatHumanDate('2025-05-20', 'en', now)).toBe('Today')
    expect(formatHumanDate('2025-05-21', 'en', now)).toBe('Tomorrow')
    expect(formatHumanDate('2025-05-19', 'en', now)).toBe('Yesterday')
    expect(formatHumanDate('2025-05-20', 'es', now)).toBe('Hoy')
    expect(formatHumanDate('2025-05-21', 'es', now)).toBe('Mañana')
    expect(formatHumanDate('2025-05-19', 'es', now)).toBe('Ayer')
  })

  it('falls back to short date with the day number', () => {
    expect(formatHumanDate('2025-05-25', 'en', now)).toContain('25')
    expect(formatHumanDate('2025-05-25', 'es', now)).toContain('25')
  })

  it('returns garbage input untouched', () => {
    expect(formatHumanDate('not-a-date', 'en', now)).toBe('not-a-date')
  })
})

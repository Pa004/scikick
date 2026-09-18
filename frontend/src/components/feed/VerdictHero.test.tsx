import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from '../../i18n'
import type { Fixture } from '../../types'
import { VerdictHero, scoreMatchesVerdict } from './VerdictHero'

const fixture: Fixture = {
  id: 1,
  date: '2026-09-18',
  home: 'Arsenal',
  away: 'Chelsea',
  status: 'pre',
  home_score: null,
  away_score: null,
  prediction: null,
  league: 'E0',
}

const homeProbs = { home: 0.65, draw: 0.23, away: 0.12 }

function renderHero(probableScore: { home: number; away: number } | null, analyst = false) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <VerdictHero fixture={fixture} probableScore={probableScore} probs={homeProbs} analyst={analyst} />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('scoreMatchesVerdict', () => {
  it('matches scorelines to verdict outcomes', () => {
    expect(scoreMatchesVerdict('home', { home: 2, away: 1 })).toBe(true)
    expect(scoreMatchesVerdict('home', { home: 1, away: 1 })).toBe(false)
    expect(scoreMatchesVerdict('away', { home: 0, away: 2 })).toBe(true)
    expect(scoreMatchesVerdict('draw', { home: 1, away: 1 })).toBe(true)
    expect(scoreMatchesVerdict('draw', { home: 1, away: 0 })).toBe(false)
  })
})

describe('VerdictHero probable score', () => {
  it('shows a consistent scoreline', () => {
    renderHero({ home: 2, away: 0 })
    expect(screen.getByText('2 - 0')).toBeDefined()
  })

  it('hides a contradicting scoreline from lay users', () => {
    renderHero({ home: 1, away: 1 })
    expect(screen.queryByText('1 - 1')).toBeNull()
    expect(screen.getByText(/Arsenal win/)).toBeDefined()
  })

  it('always shows the scoreline to analysts', () => {
    renderHero({ home: 1, away: 1 }, true)
    expect(screen.getByText('1 - 1')).toBeDefined()
  })
})

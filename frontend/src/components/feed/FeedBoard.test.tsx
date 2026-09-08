import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from '../../i18n'
import { clearDetailCaches } from '../../api/detail'
import { FeedBoard } from './FeedBoard'
import type { Fixture } from '../../types'

function makeFixtures(n: number): Fixture[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    date: '2026-09-12',
    home: `Home${i + 1}`,
    away: `Away${i + 1}`,
    status: 'pre',
    home_score: null,
    away_score: null,
    prediction: { probabilities: { home: 0.5, draw: 0.3, away: 0.2 } },
    league: 'E0',
  }))
}

function renderBoard(fixtures: Fixture[], followed: string[] = []) {
  return render(
    <LanguageProvider>
      <FeedBoard
        fixtures={fixtures}
        loading={false}
        leagueName={() => 'Premier League'}
        followed={followed}
        onToggleFollow={vi.fn()}
        analyst={false}
        fixturesForContext={fixtures}
      />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  clearDetailCaches()
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

describe('FeedBoard', () => {
  it('paginates with show more and announces counts', async () => {
    renderBoard(makeFixtures(25))
    expect(screen.getByText('Showing 20 of 25 matches')).toBeDefined()
    expect(screen.queryByText(/Home25/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show more/ }))
    expect(screen.getByText('Showing 25 of 25 matches')).toBeDefined()
    expect(screen.getByText(/Home25/)).toBeDefined()
  })

  it('expands a single story at a time', async () => {
    const fixtures = makeFixtures(2)
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/predict/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderBoard(fixtures)
    const cardToggle = (re: RegExp) =>
      screen
        .getAllByRole('button', { name: re })
        .find(b => b.getAttribute('aria-expanded') !== null) as HTMLElement
    fireEvent.click(cardToggle(/Home1 vs Away1/))
    await screen.findByText(/Home1 win/)
    fireEvent.click(cardToggle(/Home2 vs Away2/))
    await screen.findByText(/Home2 win/)
    expect(screen.queryByText(/Home1 win 6 in 10/)).toBeNull()
  })

  it('filters to followed teams only', () => {
    renderBoard(makeFixtures(3), ['Home2'])
    fireEvent.click(screen.getByRole('button', { name: 'Followed' }))
    expect(screen.queryByText(/Home1/)).toBeNull()
    expect(screen.getByText(/Home2/)).toBeDefined()
    expect(screen.queryByText(/Home3/)).toBeNull()
  })

  it('shows empty state for unmatched search', () => {
    renderBoard(makeFixtures(2))
    fireEvent.change(screen.getByLabelText(/Search team or league/), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches for this search.')).toBeDefined()
  })
})

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { ScorerPrediction } from '../types'
import ScorerPanel from './ScorerPanel'

function mockScorer(): ScorerPrediction {
  const teams = ['Arsenal', 'Arsenal', 'Arsenal', 'Chelsea', 'Chelsea', 'Chelsea', 'Arsenal']
  const venues = ['home', 'home', 'home', 'away', 'away', 'away', 'home']
  return {
    fixture_id: 1,
    data_quality: 'lineup_confirmed',
    scorers: teams.map((team, i) => ({
      player_id: i + 1,
      name: `Player${i + 1}`,
      team,
      position: 'FWD',
      xg90: 0.7 - i * 0.08,
      min_expected: 90 - i * 5,
      prob_anytime: 0.4 - i * 0.04,
      home_away: venues[i],
    })),
  }
}

function renderPanel(scorer?: ScorerPrediction) {
  render(
    <LanguageProvider>
      <ScorerPanel scorer={scorer ?? mockScorer()} />
    </LanguageProvider>,
  )
}

describe('ScorerPanel', () => {
  it('keeps the data quality badge visible', () => {
    renderPanel()
    expect(screen.getByText('Lineup confirmed')).toBeDefined()
  })

  it('caps rows and expands on demand', () => {
    renderPanel()
    expect(screen.getAllByRole('row')).toHaveLength(6)
    fireEvent.click(screen.getByText(/Show all/))
    expect(screen.getAllByRole('row')).toHaveLength(8)
    fireEvent.click(screen.getByText('Show less'))
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })

  it('toggles sort direction on header click', () => {
    renderPanel()
    const th = screen.getByRole('columnheader', { name: /prob/i })
    expect(th.getAttribute('aria-sort')).toBe('descending')
    const firstBefore = within(screen.getAllByRole('row')[1]).getByText(/Player/).textContent
    fireEvent.click(screen.getByRole('button', { name: /Sort by.*prob/i }))
    expect(screen.getByRole('columnheader', { name: /prob/i }).getAttribute('aria-sort')).toBe('ascending')
    const firstAfter = within(screen.getAllByRole('row')[1]).getByText(/Player/).textContent
    expect(firstAfter).not.toBe(firstBefore)
  })

  it('filters by team', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Away' }))
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.queryByText('Player1')).toBeNull()
  })

  it('shows empty state for unmatched search', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText(/Search player or team/), { target: { value: 'zzz' } })
    expect(screen.getByText('No players match these filters.')).toBeDefined()
  })

  it('shows no-data state without controls for empty list', () => {
    renderPanel({ fixture_id: 1, data_quality: 'projected', scorers: [] })
    expect(screen.getByText('No scorer data available for this fixture.')).toBeDefined()
    expect(screen.queryByLabelText(/Search player or team/)).toBeNull()
  })
})

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import { clearDetailCaches } from './api/detail'
import App from './App'

const mockFixtures = [
  { id: 1, date: '2026-09-12', home: 'Arsenal', away: 'Chelsea', status: 'pre', home_score: null, away_score: null, prediction: { probabilities: { home: 0.6, draw: 0.25, away: 0.15 } }, league: 'E0' },
  { id: 2, date: '2026-09-19', home: 'Liverpool', away: 'Arsenal', status: 'post', home_score: 2, away_score: 1, prediction: null, league: 'E0' },
]

function renderAt(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearDetailCaches()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
    if (url.includes('/context')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
      team: 'Arsenal', crest: null,
      form: [{ date: '2026-09-01', opponent: 'Chelsea', result: 'W', score: '2-1' }],
    }) })
    if (url.includes('/predict/scorer')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
    if (url.includes('/stats')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ total_predictions: 0, accuracy: 0, avg_confidence: 0, by_confidence_band: [], by_league: [], by_market: [], cold_start: true }) })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

describe('routes', () => {
  it('exposes one h1 per page', async () => {
    const { unmount } = renderAt(['/'])
    await screen.findAllByText(/Arsenal/)
    expect(screen.getByRole('heading', { level: 1, name: 'Fixtures' })).toBeDefined()
    unmount()
    renderAt(['/partido/1'])
    await screen.findByText(/Arsenal win/)
    expect(screen.getByRole('heading', { level: 1, name: 'Arsenal vs Chelsea' })).toBeDefined()
  })

  it('navigates between feed and followed via nav with aria-current', async () => {
    renderAt(['/'])
    await screen.findAllByText(/Arsenal/)
    const navs = screen.getAllByRole('navigation', { name: 'Sections' })
    expect(navs.length).toBe(2)
    const feedLinks = screen.getAllByRole('link', { name: 'Fixtures' })
    expect(feedLinks.every(l => l.getAttribute('aria-current') === 'page')).toBe(true)
    fireEvent.click(screen.getAllByRole('link', { name: 'Followed' })[0])
    expect(await screen.findByText('You follow no teams yet. Tap the star on any match to follow its teams.')).toBeDefined()
    expect(screen.getAllByRole('link', { name: 'Followed' }).every(l => l.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('renders the team page with upcoming matches', async () => {
    renderAt(['/equipo/Arsenal'])
    expect(await screen.findByText('Upcoming')).toBeDefined()
    expect(screen.getByRole('heading', { name: /Arsenal vs Chelsea/ })).toBeDefined()
    expect(screen.queryByRole('heading', { name: /Liverpool vs Arsenal/ })).toBeNull()
  })

  it('shows team form as letter pips', async () => {
    renderAt(['/equipo/Arsenal'])
    await screen.findByText('Upcoming')
    expect(screen.getByRole('img', { name: 'Arsenal: Form' })).toBeDefined()
    expect(screen.getByText('W')).toBeDefined()
  })

  it('shows no subnav on the match page, with back action in the follow card', async () => {
    renderAt(['/partido/1'])
    await screen.findByText(/Arsenal win/)
    expect(screen.queryByRole('navigation', { name: 'Match context' })).toBeNull()
    const aside = screen.getByRole('complementary', { name: 'Match context' })
    expect(within(aside).getByRole('button', { name: 'Back to matches' })).toBeDefined()
  })

  it('shows an actionable empty state on followed', async () => {
    renderAt(['/seguidos'])
    expect(await screen.findByText('Follow teams to pin them here')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Back to matches' })).toBeDefined()
  })

  it('opens team pages from match center links', async () => {
    renderAt(['/partido/1'])
    await screen.findByText(/Arsenal win/)
    // Match center lives in the Context tab on the match page.
    fireEvent.click(screen.getByRole('tab', { name: 'Context' }))
    const teamLink = await screen.findByRole('link', { name: 'Arsenal' })
    fireEvent.click(teamLink)
    expect(await screen.findByText('Upcoming')).toBeDefined()
  })

  it('renders not-found for unknown routes', async () => {
    renderAt(['/nope'])
    expect(await screen.findByText('Page not found')).toBeDefined()
    fireEvent.click(screen.getByRole('link', { name: 'Back to matches' }))
    await screen.findAllByText(/Arsenal/)
  })
})

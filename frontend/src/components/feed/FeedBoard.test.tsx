import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
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

function renderBoard(fixtures: Fixture[], followed: string[] = [], entries: string[] = ['/'], onDeepLink?: (id: number) => void, showValue = false) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <LanguageProvider>
        <FeedBoard
        fixtures={fixtures}
        loading={false}
        leagueName={() => 'Premier League'}
        followed={followed}
        onToggleFollow={vi.fn()}
        analyst={false}
        fixturesForContext={fixtures}
        showValue={showValue}
        onDeepLink={onDeepLink}
      />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  clearDetailCaches()
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  sessionStorage.clear()
})

describe('FeedBoard', () => {
  it('paginates with numbered pages and announces range', async () => {
    renderBoard(makeFixtures(25))
    expect(screen.getByText('Showing 1-12 of 25')).toBeDefined()
    expect(screen.queryByRole('heading', { name: /Home13/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Home25/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Página 2 de 3' }))
    expect(screen.getByText('Showing 13-24 of 25')).toBeDefined()
    expect(screen.getByRole('heading', { name: /Home13/ })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Página 3 de 3' }))
    expect(screen.getByText('Showing 25-25 of 25')).toBeDefined()
    expect(screen.getByRole('heading', { name: /Home25/ })).toBeDefined()
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

  it('filters to value matches only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/value/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ fixture_id: 2, btts: { fixtures: [] }, scorer: { fixtures: [] }, value: { outcomes: { home: { value: true } } } }),
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderBoard(makeFixtures(3), [], ['/'], undefined, true)
    // Without prefetched values the filter shows the empty value state
    expect(screen.getByText('No value found in the loaded matches yet.')).toBeDefined()
  })

  it('shows empty state when no fixtures match filter', () => {
    renderBoard(makeFixtures(2), [], ['/'], undefined, true)
    expect(screen.getByText('No value found in the loaded matches yet.')).toBeDefined()
  })

  it('groups cards under date headings', () => {
    const dated = [
      { ...makeFixtures(1)[0], id: 1, date: '2026-09-12' },
      { ...makeFixtures(1)[0], id: 2, date: '2026-09-13' },
      { ...makeFixtures(1)[0], id: 3, date: '2026-09-12' },
    ]
    renderBoard(dated)
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings).toHaveLength(2)
  })

  it('resets pagination when toggling filters', () => {
    const { rerender } = renderBoard(makeFixtures(25))
    fireEvent.click(screen.getByRole('button', { name: 'Página 2 de 3' }))
    expect(screen.getByText('Showing 13-24 of 25')).toBeDefined()
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <LanguageProvider>
          <FeedBoard
            fixtures={makeFixtures(25)}
            loading={false}
            leagueName={() => 'Premier League'}
            followed={[]}
            onToggleFollow={vi.fn()}
            analyst={false}
            fixturesForContext={makeFixtures(25)}
            showValue={true}
          />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('No value found in the loaded matches yet.')).toBeDefined()
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <LanguageProvider>
          <FeedBoard
            fixtures={makeFixtures(25)}
            loading={false}
            leagueName={() => 'Premier League'}
            followed={[]}
            onToggleFollow={vi.fn()}
            analyst={false}
            fixturesForContext={makeFixtures(25)}
            showValue={false}
          />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Showing 1-12 of 25')).toBeDefined()
  })

  it('notices deep links missing from the feed and dismisses', () => {
    renderBoard(makeFixtures(2), [], ['/?partido=999'])
    expect(screen.getByText('That match is not in the current list.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('That match is not in the current list.')).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('navigates instead of expanding on desktop when routed', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const onDeepLink = vi.fn()
    renderBoard(makeFixtures(2), [], ['/'], onDeepLink)
    const cardToggle = screen
      .getAllByRole('button', { name: /Home1 vs Away1/ })
      .find(b => b.getAttribute('aria-expanded') !== null) as HTMLElement
    fireEvent.click(cardToggle)
    expect(onDeepLink).toHaveBeenCalledWith(1)
    expect(screen.queryByText(/Home1 win 6 in 10/)).toBeNull()
    const saved = JSON.parse(sessionStorage.getItem('scikick.feed-state') ?? '{}')
    expect(saved.page).toBe(1)
  })

  it('restores saved scroll state once on mount', () => {
    sessionStorage.setItem('scikick.feed-state', JSON.stringify({ y: 500, page: 2 }))
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    renderBoard(makeFixtures(50))
    expect(screen.getByText('Showing 13-24 of 50')).toBeDefined()
    expect(sessionStorage.getItem('scikick.feed-state')).toBeNull()
  })
})

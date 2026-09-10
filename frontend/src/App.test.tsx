import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import { clearDetailCaches } from './api/detail'
import App from './App'

// Radix Menu hangs jsdom workers (verified live instead); mock the shell,
// test our wiring.
vi.mock('@radix-ui/react-dropdown-menu', async () => {
  const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>
  return {
    Root: passthrough,
    Trigger: passthrough,
    Portal: passthrough,
    Content: ({ children, ...props }: { children: ReactNode }) => (
      <div role="menu" {...props}>{children}</div>
    ),
    Item: ({ children, onSelect, ...props }: { children: ReactNode; onSelect?: () => void }) => (
      <div role="menuitem" onClick={onSelect} {...props}>{children}</div>
    ),
    CheckboxItem: ({ children, checked, onCheckedChange, ...props }: {
      children: ReactNode; checked?: boolean; onCheckedChange?: (v: boolean) => void
    }) => (
      <div role="menuitemcheckbox" aria-checked={checked} onClick={() => onCheckedChange?.(!checked)} {...props}>
        {children}
      </div>
    ),
    ItemIndicator: passthrough,
    RadioGroup: ({ children }: { children: ReactNode }) => <div role="radiogroup">{children}</div>,
    RadioItem: ({ children, value, ...props }: { children: ReactNode; value?: string }) => (
      <div role="menuitemradio" data-value={value} {...props}>{children}</div>
    ),
    Label: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
    Separator: (props: object) => <hr {...props} />,
  }
})

function renderApp(entries: string[] = ['/']) {
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

const mockFixtures = [
  { id: 1, date: '2025-08-17', home: 'Arsenal', away: 'Chelsea', status: 'post', home_score: 2, away_score: 1, prediction: { probabilities: { home: 0.6, draw: 0.25, away: 0.15 } }, league: 'E0' },
  { id: 2, date: '2025-08-17', home: 'Liverpool', away: 'Man City', status: 'pre', home_score: null, away_score: null, prediction: null, league: 'E0' },
]

const mockStats = {
  total_predictions: 150,
  accuracy: 0.62,
  avg_confidence: 0.58,
  by_confidence_band: [
    { band: 'high (>=70%)', total: 30, hits: 21, accuracy: 0.7 },
    { band: 'medium (50-70%)', total: 80, hits: 48, accuracy: 0.6 },
    { band: 'low (<50%)', total: 40, hits: 20, accuracy: 0.5 },
  ],
  by_league: [{ league: 'E0', total: 150, hits: 93, accuracy: 0.62 }],
  by_market: [{ market: '1x2', total: 150, hits: 93, accuracy: 0.62, cold_start: false }],
  cold_start: false,
}

const mockMatchday = { market: '1x2', league: null, cold_start: false, data: [
  { matchday: '2025-08-10', total: 10, hits: 6, accuracy: 0.6, brier: 0.05 },
] }
const mockCalibration = { market: '1x2', league: null, cold_start: false, data: [] }

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
    if (url.includes('/stats/per-matchday')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMatchday) })
    if (url.includes('/stats/calibration')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCalibration) })
    if (url.includes('/stats')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) })
    if (url.includes('/context')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
      team: 'Arsenal',
      form: [{ date: '2025-08-10', opponent: 'Chelsea', result: 'W', score: '2-1' }],
      opponent: 'Chelsea',
      h2h: { wins: 2, draws: 1, losses: 0, matches: [
        { date: '2025-08-10', home: 'Arsenal', away: 'Chelsea', score: '2-1' },
      ] },
    }) })
    if (url.includes('/predict/scorer')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'ensemble_v1', model_agreement: 0.85, probabilities: { '1x2': { home: 0.5, draw: 0.25, away: 0.25 } } }) })
    return Promise.resolve({ ok: false, status: 404 })
  }))
}

beforeEach(() => {
  stubFetch()
  clearDetailCaches()
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

// Card toggle buttons share team names with the pick-of-the-day card;
// scope by the expand semantics only story cards have.
function cardToggle(re: RegExp): HTMLElement {
  const found = screen
    .getAllByRole('button', { name: re })
    .find(b => b.getAttribute('aria-expanded') !== null)
  if (!found) throw new Error(`No story toggle matching ${re}`)
  return found as HTMLElement
}

describe('App feed', () => {
  it('renders SciKick heading', () => {
    renderApp()
    expect(screen.getByText('SciKick')).toBeDefined()
  })

  it('shows loading state', () => {
    renderApp()
    expect(screen.getByRole('status', { name: 'Loading...' })).toBeDefined()
  })

  it('renders match cards after loading', async () => {
    renderApp()
    const arsenal = await screen.findAllByText(/Arsenal/)
    expect(arsenal.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Liverpool/).length).toBeGreaterThan(0)
  })

  it('filters cards via search and shows empty state', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'Liverpool' } })
    expect(screen.queryByText(/Arsenal/)).toBeNull()
    expect(screen.getAllByText(/Liverpool/).length).toBeGreaterThan(0)
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('No matches for this search.')).toBeDefined()
  })

  it('switches league via switcher', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByRole('button', { name: 'La Liga' }))
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('league=SP1'))
  })

  it('expands one story at a time with verdict and match center', async () => {
    renderApp()
    await screen.findByText('Pick of the Day')
    fireEvent.click(screen.getByRole('button', { name: /Pick of the Day/ }))
    expect(await screen.findByText(/Arsenal win/)).toBeDefined()
    expect(screen.getByText('Match Center')).toBeDefined()
    expect(await screen.findByText((_c, el) => el?.textContent === 'Arsenal 2 - 1 - 0 Chelsea')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Liverpool vs Man City/ }))
    await screen.findByText((_c, el) => el?.tagName === 'P' && /Liverpool win|Man City win|Draw/.test(el?.textContent ?? ''))
    expect(screen.queryByText((_c, el) => el?.textContent === 'Arsenal 2 - 1 - 0 Chelsea')).toBeNull()
  })

  it('opens the model drawer with calibration', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Model' })[0])
    expect(await screen.findByText('Well calibrated. Predictions land close to actual outcomes.')).toBeDefined()
  })

  it('follows teams and filters to followed only', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByRole('button', { name: 'Follow Arsenal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Followed' }))
    expect(screen.queryByText(/Liverpool/)).toBeNull()
    expect(screen.getAllByText(/Arsenal/).length).toBeGreaterThan(0)
  })

  it('shows retry when fixtures fail to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    renderApp()
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeDefined()
    stubFetch()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findAllByText(/Arsenal/)
  })

  it('exposes skip link and main landmark', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeDefined()
    expect(screen.getByRole('main')).toBeDefined()
  })

  it('routes legacy deep links to the match page', async () => {
    renderApp(['/?partido=1'])
    expect(await screen.findByText(/Arsenal win/)).toBeDefined()
    expect(screen.getByText('Match Center')).toBeDefined()
  })

  it('shows a miss notice for unknown match routes', async () => {
    renderApp(['/partido/999'])
    expect(await screen.findByText('That match is not in the current list.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back to matches' }))
    await screen.findAllByText(/Arsenal/)
  })

  it('shows story error with retry and recovers', async () => {
    let failed = false
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
      if (url.includes('/predict/scorer')) return Promise.resolve({ ok: false, status: 404 })
      if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
      if (url.includes('/context')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ team: 'X', form: [], h2h: { wins: 0, draws: 0, losses: 0, matches: [] } }) })
      if (url.includes('/predict/')) {
        if (!failed) {
          failed = true
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(cardToggle(/Arsenal vs Chelsea/))
    expect(await screen.findByText('Could not load this match. Check your connection and try again.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Arsenal win/)).toBeDefined()
  })

  it('collapses the story on second toggle and clears the deep link', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(cardToggle(/Arsenal vs Chelsea/))
    await screen.findByText(/Arsenal win/)
    expect(window.location.search).toContain('partido=1')
    fireEvent.click(cardToggle(/Arsenal vs Chelsea/))
    expect(screen.queryByText(/Arsenal win 6 in 10/)).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('ignores deep links to fixtures outside the feed', async () => {
    window.history.replaceState(null, '', '/?partido=999')
    renderApp()
    await screen.findAllByText(/Arsenal/)
    expect(screen.queryByLabelText('Loading match story...')).toBeNull()
    expect(screen.getAllByText(/Arsenal/).length).toBeGreaterThan(0)
  })

  it('filters to value matches after background prefetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: { body?: string }) => {
      if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
      if (url.includes('/api/value')) {
        const body = JSON.parse(init?.body ?? '{}') as { fixture_id?: number }
        const edge = body.fixture_id === 1 ? 0.09 : -0.1
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          fixture_id: body.fixture_id,
          outcomes: {
            home: { prob: 0.5, odds: 2.1, edge, value: edge > 0, kelly: 0.02 },
            draw: { prob: 0.25, odds: 3.4, edge: -0.1, value: false, kelly: 0 },
            away: { prob: 0.25, odds: 3.6, edge: -0.2, value: false, kelly: 0 },
          },
        }) })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderApp()
    await screen.findAllByText(/Arsenal/)
    expect(await screen.findByText('+EV')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Value' }))
    expect(screen.queryByText(/Liverpool/)).toBeNull()
    expect(screen.getAllByText(/Arsenal/).length).toBeGreaterThan(0)
  })

  it('opens the story on the 1x2 market from a bar segment', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByLabelText('1 · Arsenal: 60.0%'))
    await screen.findByText(/Arsenal win/)
    expect(screen.getAllByText('Full-time result').length).toBeGreaterThan(0)
  })

  it('closes the model drawer with Escape', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Model' })[0])
    await screen.findByText('Calibration')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Calibration')).toBeNull()
  })

  it('shows scorer data inside the story', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
      if (url.includes('/predict/scorer')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        fixture_id: 1,
        data_quality: 'lineup_confirmed',
        scorers: [{ player_id: 1, name: 'Saka', team: 'Arsenal', position: 'FWD', xg90: 0.5, min_expected: 90, prob_anytime: 0.4, home_away: 'home' }],
      }) })
      if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
      if (url.includes('/context')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ team: 'X', form: [], h2h: { wins: 0, draws: 0, losses: 0, matches: [] } }) })
      if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(cardToggle(/Arsenal vs Chelsea/))
    expect(await screen.findByText('Saka')).toBeDefined()
    expect(screen.getByText('Lineup confirmed')).toBeDefined()
  })

  it('falls back to local form when context fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
      if (url.includes('/predict/scorer')) return Promise.resolve({ ok: false, status: 404 })
      if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
      if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
      return Promise.resolve({ ok: false, status: 404 })
    }))
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(cardToggle(/Arsenal vs Chelsea/))
    // Server context 404s: form falls back to loaded fixtures (Arsenal W, Chelsea L)
    const badges = await screen.findAllByRole('listitem', { name: /Win|Loss/ })
    expect(badges.length).toBe(2)
    expect(screen.getByText((_c, el) => el?.textContent === 'Arsenal 1 - 0 - 0 Chelsea')).toBeDefined()
  })

  it('persists the theme toggle across reloads', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    expect(localStorage.getItem('scikick.theme') ?? 'dark').toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(localStorage.getItem('scikick.theme')).toBe('light')
  })

  it('switches language across the feed', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Fixtures' })
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Español/ }))
    expect(await screen.findByRole('heading', { name: 'Partidos' })).toBeDefined()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /English/ }))
    expect(await screen.findByRole('heading', { name: 'Fixtures' })).toBeDefined()
  })
})

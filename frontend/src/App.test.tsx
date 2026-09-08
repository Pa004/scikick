import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from './i18n'
import App from './App'

function renderApp() {
  return render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
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
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

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
    fireEvent.change(screen.getByLabelText(/Search team or league/), { target: { value: 'Liverpool' } })
    expect(screen.queryByText(/Arsenal/)).toBeNull()
    expect(screen.getAllByText(/Liverpool/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText(/Search team or league/), { target: { value: 'zzz' } })
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
    fireEvent.click(screen.getByRole('button', { name: 'Model' }))
    expect(await screen.findByText('Well calibrated. Predictions land close to actual outcomes.')).toBeDefined()
  })

  it('follows teams and filters to followed only', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByRole('button', { name: /Follow Arsenal/ }))
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

  it('auto-expands the deep-linked fixture', async () => {
    window.history.replaceState(null, '', '/?partido=1')
    renderApp()
    expect(await screen.findByText(/Arsenal win/)).toBeDefined()
  })
})

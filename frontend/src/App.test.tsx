import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

const mockFixtures = [
  { id: 1, date: '2025-08-17', home: 'Arsenal', away: 'Chelsea', status: 'post', home_score: 2, away_score: 1, prediction: { markets: {} }, league: 'E0' },
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

const mockMatchday = { market: '1x2', league: null, cold_start: false, data: [] }
const mockCalibration = { market: '1x2', league: null, cold_start: false, data: [] }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
    if (url.includes('/stats/per-matchday')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMatchday) })
    if (url.includes('/stats/calibration')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCalibration) })
    if (url.includes('/stats')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) })
    if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'ensemble_v1', model_agreement: 0.85, probabilities: { '1x2': { home: 0.5, draw: 0.25, away: 0.25 } } }) })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

describe('App', () => {
  it('renders SciKick heading', () => {
    render(<App />)
    expect(screen.getByText('SciKick')).toBeDefined()
  })

  it('shows loading state', () => {
    render(<App />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('renders fixtures after loading', async () => {
    render(<App />)
    const arsenal = await screen.findByText(/Arsenal/)
    expect(arsenal).toBeDefined()
    expect(screen.getByText(/Liverpool/)).toBeDefined()
  })

  it('shows stats when no fixture selected', async () => {
    render(<App />)
    await screen.findByText(/Arsenal/)
    expect(screen.getAllByText('150').length).toBeGreaterThan(0)
    expect(screen.getAllByText('62.0%').length).toBeGreaterThan(0)
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { Stats, MatchdayData, CalibrationData } from '../types'
import StatsDashboard from './StatsDashboard'

const stats: Stats = {
  total_predictions: 100, accuracy: 0.6, avg_confidence: 0.55,
  by_confidence_band: [], by_league: [], by_market: [], cold_start: false,
}

const marketStats: Stats = {
  ...stats,
  by_market: [
    { market: 'btts', total: 40, hits: 22, accuracy: 0.54, cold_start: false },
    { market: '1x2', total: 100, hits: 60, accuracy: 0.6, cold_start: false },
    { market: 'corners_total', total: 20, hits: 2, accuracy: 0.09, cold_start: false },
  ],
  by_league: [
    { league: 'E0', total: 60, hits: 30, accuracy: 0.5 },
    { league: 'SP1', total: 40, hits: 28, accuracy: 0.7 },
  ],
}

function matchday(brier: number): MatchdayData {
  return {
    market: '1x2', league: null, cold_start: false,
    data: [{ matchday: '1', total: 10, hits: 6, accuracy: 0.6, brier }],
  }
}

const calibration: CalibrationData = {
  market: '1x2', league: null, cold_start: false,
  data: [
    { bin_center: 0.6, avg_predicted: 0.62, actual_accuracy: 0.6, count: 20 },
    { bin_center: 0.3, avg_predicted: 0.3, actual_accuracy: 0.5, count: 10 },
  ],
}

function renderDashboard(brier: number | null, cal: CalibrationData | null = calibration) {
  render(
    <LanguageProvider>
      <StatsDashboard
        stats={stats}
        matchdayData={brier === null ? null : matchday(brier)}
        calibrationData={cal}
        selectedMarket="1x2"
      />
    </LanguageProvider>,
  )
}

describe('StatsDashboard trust block', () => {
  it('shows brier reading, calibration count and sample size', () => {
    renderDashboard(0.05)
    expect(screen.getByText('Calibration')).toBeDefined()
    expect(screen.getByText('0.050')).toBeDefined()
    expect(screen.getByText('Well calibrated. Predictions land close to actual outcomes.')).toBeDefined()
    expect(screen.getByText('1 of 2 ranges within 10 pts of perfect calibration.')).toBeDefined()
    expect(screen.getByText('Based on 100 resolved predictions (calibration n=30).')).toBeDefined()
  })

  it('grades reasonable and weak brier thresholds', () => {
    renderDashboard(0.2)
    expect(screen.getByText('Reasonably calibrated. Useful signal, expect some error.')).toBeDefined()
  })

  it('hides the block on cold start', () => {
    render(
      <LanguageProvider>
        <StatsDashboard stats={{ ...stats, cold_start: true }} matchdayData={null} calibrationData={null} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    expect(screen.queryByText('Calibration')).toBeNull()
  })

  it('drops the redundant calibration count when it matches the total', () => {
    const full: CalibrationData = {
      market: '1x2', league: null, cold_start: false,
      data: [{ bin_center: 0.6, avg_predicted: 0.62, actual_accuracy: 0.6, count: 100 }],
    }
    render(
      <LanguageProvider>
        <StatsDashboard stats={stats} matchdayData={null} calibrationData={full} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    expect(screen.getByText('Based on 100 resolved predictions.')).toBeDefined()
    expect(screen.queryByText(/calibration n=/)).toBeNull()
  })

  it('shows pending states without matchday or calibration data', () => {
    renderDashboard(null, null)
    expect(screen.getByText('Per matchday: not enough matchdays yet.')).toBeDefined()
    expect(screen.getByText('Calibration still pending. Check back after 30 resolved predictions.')).toBeDefined()
  })

  it('shows the scope chip when provided', () => {
    render(
      <LanguageProvider>
        <StatsDashboard stats={stats} matchdayData={null} calibrationData={null} selectedMarket="1x2" scopeName="La Liga" />
      </LanguageProvider>,
    )
    expect(screen.getByText('La Liga')).toBeDefined()
  })

  it('maps market and league codes to display names', () => {
    render(
      <LanguageProvider>
        <StatsDashboard stats={marketStats} matchdayData={null} calibrationData={null} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    expect(screen.getByText('Both teams score')).toBeDefined()
    expect(screen.queryByText('btts')).toBeNull()
    expect(screen.getByText('Premier League')).toBeDefined()
    expect(screen.queryByText('E0')).toBeNull()
  })

  it('sorts markets by accuracy descending by default and toggles', () => {
    const { container } = render(
      <LanguageProvider>
        <StatsDashboard stats={marketStats} matchdayData={null} calibrationData={null} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    const order = () => Array.from(container.querySelectorAll('tbody tr')).map(r => r.textContent)
    expect(order()[0]).toContain('60.0%')
    fireEvent.click(screen.getByRole('button', { name: /Sort by.*ccuracy/ }))
    expect(order()[0]).toContain('9.0%')
  })

  it('filters markets by text', () => {
    render(
      <LanguageProvider>
        <StatsDashboard stats={marketStats} matchdayData={null} calibrationData={null} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    fireEvent.change(screen.getByPlaceholderText(/Search markets/), { target: { value: 'corners' } })
    expect(screen.getByText(/corners/i)).toBeDefined()
    expect(screen.queryByText('Both teams score')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/Search markets/), { target: { value: 'zzz' } })
    expect(screen.getByText('No matching markets.')).toBeDefined()
  })
})

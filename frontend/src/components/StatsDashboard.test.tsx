import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { Stats, MatchdayData, CalibrationData } from '../types'
import StatsDashboard from './StatsDashboard'

const stats: Stats = {
  total_predictions: 100, accuracy: 0.6, avg_confidence: 0.55,
  by_confidence_band: [], by_league: [], by_market: [], cold_start: false,
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
    expect(screen.getByText('Why trust these numbers')).toBeDefined()
    expect(screen.getByText('0.050')).toBeDefined()
    expect(screen.getByText('Well calibrated — predictions land close to actual outcomes.')).toBeDefined()
    expect(screen.getByText('1 of 2 ranges within 10 pts of perfect calibration.')).toBeDefined()
    expect(screen.getByText('Based on 100 resolved predictions (calibration n=30).')).toBeDefined()
  })

  it('grades reasonable and weak brier thresholds', () => {
    renderDashboard(0.2)
    expect(screen.getByText('Reasonably calibrated — useful signal, expect some error.')).toBeDefined()
  })

  it('hides the block on cold start', () => {
    render(
      <LanguageProvider>
        <StatsDashboard stats={{ ...stats, cold_start: true }} matchdayData={null} calibrationData={null} selectedMarket="1x2" />
      </LanguageProvider>,
    )
    expect(screen.queryByText('Why trust these numbers')).toBeNull()
  })

  it('shows pending states without matchday or calibration data', () => {
    renderDashboard(null, null)
    expect(screen.getByText('Not enough matchdays yet to judge calibration.')).toBeDefined()
    expect(screen.getByText('Calibration still pending — check back after 30 resolved predictions.')).toBeDefined()
  })
})

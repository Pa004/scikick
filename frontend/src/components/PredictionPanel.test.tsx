import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { Prediction } from '../types'
import PredictionPanel from './PredictionPanel'

const prediction: Prediction = {
  fixture_id: 1,
  model_version: 'ensemble_v1_E0',
  model_agreement: 0.85,
  probabilities: {
    '1x2': { home: 0.5, draw: 0.3, away: 0.2 },
    btts: { yes: 0.55, no: 0.45 },
  },
  probable_score: { home: 2, away: 1 },
  top_features: [{ feature: 'home_elo', value: 1616.5, shap_importance: 0.4 }],
}

function renderPanel(analyst: boolean) {
  render(
    <LanguageProvider>
      <PredictionPanel
        prediction={prediction}
        selectedMarket="1x2"
        onMarketChange={() => {}}
        home="Arsenal"
        away="Chelsea"
        fixtures={[]}
        analyst={analyst}
      />
    </LanguageProvider>,
  )
}

describe('PredictionPanel analyst mode', () => {
  it('hides technical detail by default', () => {
    renderPanel(false)
    expect(screen.queryByText('Top Features')).toBeNull()
    expect(screen.queryByText(/ensemble_v1_E0/)).toBeNull()
    expect(screen.getAllByText('Full-time result').length).toBeGreaterThan(0)
  })

  it('reveals model internals and raw keys when enabled', () => {
    renderPanel(true)
    expect(screen.getByText('Top Features')).toBeDefined()
    expect(screen.getByText(/ensemble_v1_E0/)).toBeDefined()
    expect(screen.getAllByText('Full-time result · 1x2').length).toBeGreaterThan(0)
  })
})

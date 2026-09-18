import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from '../i18n'
import type { Fixture, Prediction } from '../types'
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

function renderPanel(analyst: boolean, marketLayout: 'stack' | 'parallel' = 'stack') {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <PredictionPanel
        prediction={prediction}
        selectedMarket="1x2"
        onMarketChange={() => {}}
        home="Arsenal"
        away="Chelsea"
        fixtures={[]}
        analyst={analyst}
        marketLayout={marketLayout}
      />
      </LanguageProvider>
    </MemoryRouter>,
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

describe('PredictionPanel match center', () => {
  // Arsenal form, most recent first: W, L, D, D (5 pts); Chelsea: W, D (4 pts).
  const contextFixtures: Fixture[] = [
    { id: 11, date: '2025-05-04', home: 'Arsenal', away: 'Everton', status: 'post', home_score: 2, away_score: 0, prediction: null, league: 'E0' },
    { id: 12, date: '2025-05-03', home: 'Arsenal', away: 'Chelsea', status: 'post', home_score: 0, away_score: 1, prediction: null, league: 'E0' },
    { id: 13, date: '2025-05-02', home: 'Spurs', away: 'Arsenal', status: 'post', home_score: 1, away_score: 1, prediction: null, league: 'E0' },
    { id: 14, date: '2025-04-01', home: 'Chelsea', away: 'Arsenal', status: 'post', home_score: 2, away_score: 2, prediction: null, league: 'E0' },
  ]

  function renderWithContext(storyTabs = false) {
    return render(
      <MemoryRouter>
        <LanguageProvider>
          <PredictionPanel
            prediction={prediction}
            selectedMarket="1x2"
            onMarketChange={() => {}}
            home="Arsenal"
            away="Chelsea"
            fixtures={contextFixtures}
            analyst={false}
            storyTabs={storyTabs}
          />
        </LanguageProvider>
      </MemoryRouter>,
    )
  }

  afterEach(() => {
    window.localStorage.removeItem('scikick.locale')
  })

  it('labels the head-to-head summary as a sentence', () => {
    renderWithContext()
    expect(screen.getByText('Arsenal won 0 · 1 draws · Chelsea won 1')).toBeDefined()
  })

  it('shows recent points as a fraction of the maximum, not a bare probability', () => {
    renderWithContext()
    expect(screen.getByText('Recent points')).toBeDefined()
    expect(screen.getByText('Points earned out of the maximum, last 4')).toBeDefined()
    expect(screen.getByText('5 of 12 pts · 42%')).toBeDefined()
    expect(screen.getByText('4 of 12 pts · 33%')).toBeDefined()
  })

  it('labels the real sample window instead of always “last 5”', () => {
    renderWithContext()
    expect(screen.getByText('Form · Last 4')).toBeDefined()
  })

  it('nests subsections as h4 under the card title', () => {
    const { container } = renderWithContext()
    expect(container.querySelectorAll('h4')).toHaveLength(3)
  })

  it('localizes meeting dates instead of ISO strings', () => {
    renderWithContext()
    expect(screen.queryByText(/2025-03-10/)).toBeNull()
    expect(screen.getByText(/Arsenal 0 - 1 Chelsea/)).toBeDefined()
  })

  it('groups form rows and meetings with subtle separators', () => {
    const { container } = renderWithContext()
    expect(container.querySelectorAll('.divide-y')).toHaveLength(2)
    // Date sits in its own column, apart from the scoreline.
    expect(screen.getByText('May 3, 2025')).toBeDefined()
  })

  it('localizes form letters and order hint in Spanish', () => {
    window.localStorage.setItem('scikick.locale', 'es')
    renderWithContext()
    expect(screen.getAllByText('V').length).toBeGreaterThan(0)
    expect(screen.getByText('más reciente →')).toBeDefined()
    expect(screen.getByText('Forma · Últimos 4')).toBeDefined()
    expect(screen.getByText('Arsenal ganó 0 · 1 empates · Chelsea ganó 1')).toBeDefined()
    expect(screen.getByText('5 de 12 pts · 42%')).toBeDefined()
  })

  it('stacks every block without tabs by default', () => {
    const { container } = renderWithContext()
    expect(container.querySelector('[role="tablist"]')).toBeNull()
  })

  it('shows markets first with context and value parked in hidden panels', () => {
    const { container } = renderWithContext(true)
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    // Chart visible; other panels mounted but hidden (state preserved).
    expect(screen.getAllByText('Full-time result').length).toBeGreaterThan(0)
    expect(container.querySelector('#storypanel-1-context')?.hasAttribute('hidden')).toBe(true)
    expect(container.querySelector('#storypanel-1-value')?.hasAttribute('hidden')).toBe(true)
  })

  it('filters markets from the search aligned in the tab row', () => {
    const { container } = renderWithContext(true)
    const search = container.querySelector('[role="tablist"] input[type="search"]')
    expect(search).not.toBeNull()
    fireEvent.change(search!, { target: { value: 'both' } })
    expect(screen.getAllByText('Both teams score').length).toBeGreaterThan(0)
    expect(screen.getByText('Goals')).toBeDefined()
    expect(screen.queryByText('Results')).toBeNull()
  })

  it('shows the market search only on the markets tab', () => {
    renderWithContext(true)
    expect(screen.getByPlaceholderText(/Search markets/)).toBeDefined()
    fireEvent.click(screen.getByRole('tab', { name: 'Value' }))
    expect(screen.queryByPlaceholderText(/Search markets/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Markets' }))
    expect(screen.getByPlaceholderText(/Search markets/)).toBeDefined()
  })

  it('switches panels when tabs are clicked', () => {
    const { container } = renderWithContext(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Context' }))
    expect(container.querySelector('#storypanel-1-context')?.hasAttribute('hidden')).toBe(false)
    expect(container.querySelector('#storypanel-1-markets')?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('Recent points')).toBeDefined()
    fireEvent.click(screen.getByRole('tab', { name: 'Value' }))
    expect(screen.getByText('Value check')).toBeDefined()
  })
})

describe('PredictionPanel combo note', () => {
  it('explains the independence assumption in plain language', () => {
    renderPanel(false)
    expect(screen.getByText('Rough guide: these markets influence each other, so treat it as a reference.')).toBeDefined()
  })
})

describe('PredictionPanel market layout', () => {
  it('stacks selector and chart by default', () => {
    const { container } = renderPanel(false)
    expect(container.querySelector('[class*="xl:grid-cols"]')).toBeNull()
  })

  it('places selector and chart side by side in parallel mode', () => {
    const { container } = renderPanel(false, 'parallel')
    expect(container.querySelector('[class*="xl:grid-cols"]')).not.toBeNull()
    expect(container.querySelector('[class*="xl:sticky"]')).not.toBeNull()
  })
})

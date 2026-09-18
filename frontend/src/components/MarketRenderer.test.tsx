import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LanguageProvider } from '../i18n'
import MarketRenderer from './MarketRenderer'
import DisplayModeToggle from './DisplayModeToggle'

const probs = { '1x2': { home: 0.5, draw: 0.25, away: 0.25 } }

function renderRenderer(mode: 'prob' | 'odds' = 'prob', moves = {}) {
  render(
    <LanguageProvider>
      <MarketRenderer market="1x2" probabilities={probs} mode={mode} moves={moves} />
    </LanguageProvider>,
  )
}

describe('MarketRenderer display mode', () => {
  it('shows percentages in prob mode', () => {
    renderRenderer('prob')
    expect(screen.getByText('50.0%')).toBeDefined()
  })

  it('shows decimals in odds mode and keeps fill width in percent', () => {
    const { container } = render(
      <LanguageProvider>
        <MarketRenderer market="1x2" probabilities={probs} mode="odds" />
      </LanguageProvider>,
    )
    expect(screen.getByText('2.00')).toBeDefined()
    expect(screen.getAllByText('4.00').length).toBe(2)
    const fill = container.querySelector('.prob-bar-fill')
    expect(fill?.getAttribute('style')).toContain('width: 50%')
  })

  it('renders movement arrows with accessible labels', () => {
    renderRenderer('odds', { home: 'up', draw: 'flat', away: 'down' })
    expect(screen.getByLabelText('Odds shortened')).toBeDefined()
    expect(screen.getByLabelText('Odds lengthened')).toBeDefined()
  })
})

function renderMarket(market: string, probabilities: Record<string, Record<string, number>>) {
  return render(
    <LanguageProvider>
      <MarketRenderer market={market} probabilities={probabilities} />
    </LanguageProvider>,
  )
}

describe('MarketRenderer market routing', () => {
  it('renders half-time over/under as bars instead of raw JSON', () => {
    renderMarket('ht_over_under_1.5', { 'ht_over_under_1.5': { over: 0.43, under: 0.57 } })
    expect(screen.getByText('43.0%')).toBeDefined()
    expect(screen.getByText('57.0%')).toBeDefined()
    expect(screen.queryByText(/"over"/)).toBeNull()
  })

  it('renders double chance with its three real outcomes', () => {
    renderMarket('double_chance', { double_chance: { home_or_draw: 0.58, draw_or_away: 0.73, home_or_away: 0.69 } })
    expect(screen.getByText('Home or draw')).toBeDefined()
    expect(screen.getByText('Draw or away')).toBeDefined()
    expect(screen.getByText('Home or away')).toBeDefined()
    expect(screen.getByText('58.0%')).toBeDefined()
  })

  it('hides zero-probability rows in void-if-draw markets', () => {
    renderMarket('draw_no_bet', { draw_no_bet: { home: 0.39, draw: 0, away: 0.61 } })
    expect(screen.getByText('39.0%')).toBeDefined()
    expect(screen.getByText('61.0%')).toBeDefined()
    expect(screen.queryByText('Draw (void)')).toBeNull()
  })

  it('shows one halftime scenario at a time with chips', () => {
    const { container } = renderMarket('ft_result_given_ht', {
      ft_result_given_ht: {
        'ht_0-0_ft_1x2': { home: 0.26, draw: 0.32, away: 0.42 },
        'ht_1-0_ft_1x2': { home: 0.55, draw: 0.24, away: 0.21 },
      },
    } as unknown as Record<string, Record<string, number>>)
    expect(container.querySelectorAll('.prob-bar-fill')).toHaveLength(3)
    expect(screen.getByText('26.0%')).toBeDefined()
    expect(screen.queryByText('55.0%')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Half-time 1-0' }))
    expect(container.querySelectorAll('.prob-bar-fill')).toHaveLength(3)
    expect(screen.getByText('55.0%')).toBeDefined()
    expect(screen.queryByText('26.0%')).toBeNull()
  })
})

describe('DisplayModeToggle', () => {
  it('reflects mode and notifies on change', () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider>
        <DisplayModeToggle mode="prob" onChange={onChange} />
      </LanguageProvider>,
    )
    expect(screen.getByText('Probability').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByText('Odds'))
    expect(onChange).toHaveBeenCalledWith('odds')
  })
})

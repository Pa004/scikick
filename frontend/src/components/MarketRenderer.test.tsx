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

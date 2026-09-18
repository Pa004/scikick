import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LanguageProvider } from '../i18n'
import MarketSelector from './MarketSelector'

const available = ['1x2', 'double_chance', 'over_under_2.5', 'btts', 'ht_1x2']

function renderSelector(selected = '1x2') {
  const onChange = vi.fn()
  render(
    <LanguageProvider>
      <MarketSelector selected={selected} onChange={onChange} availableMarkets={available} />
    </LanguageProvider>,
  )
  return onChange
}

describe('MarketSelector', () => {
  it('renders only groups with available markets', () => {
    renderSelector()
    expect(screen.getByText('Results')).toBeDefined()
    expect(screen.getByText('Goals')).toBeDefined()
    expect(screen.getByText('1st Half')).toBeDefined()
    expect(screen.queryByText('Corners')).toBeNull()
  })

  it('opens the group holding the selection on mount', () => {
    renderSelector('ht_1x2')
    expect(screen.queryByText('Double chance')).toBeNull()
    expect(screen.queryByText('Full-time result')).toBeNull()
    expect(screen.getByText('1st Half')).toBeDefined()
    expect(screen.getByText('Results')).toBeDefined()
  })

  it('marks the active group with a selected-market note', () => {
    renderSelector()
    expect(screen.getByText('Double chance')).toBeDefined()
    expect(screen.getByText(/Contains the selected market/)).toBeDefined()
  })

  it('keeps multiple groups open at a time', () => {
    renderSelector()
    expect(screen.getByText('Double chance')).toBeDefined()
    fireEvent.click(screen.getByText('Goals'))
    expect(screen.getByText('Double chance')).toBeDefined()
    expect(screen.getByText('Over / Under 2.5 goals')).toBeDefined()
  })

  it('calls onChange with the market key', () => {
    const onChange = renderSelector()
    fireEvent.click(screen.getByText('Double chance'))
    expect(onChange).toHaveBeenCalledWith('double_chance')
  })

  it('keeps the group open after selecting an option', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <LanguageProvider>
        <MarketSelector selected="1x2" onChange={onChange} availableMarkets={available} />
      </LanguageProvider>,
    )
    fireEvent.click(screen.getByText('Double chance'))
    expect(onChange).toHaveBeenCalledWith('double_chance')
    // Parent updates the selection; the open group must survive for live comparison.
    rerender(
      <LanguageProvider>
        <MarketSelector selected="double_chance" onChange={onChange} availableMarkets={available} />
      </LanguageProvider>,
    )
    expect(screen.getByText('Double chance')).toBeDefined()
  })

  it('filters markets by text, keeping their groups', () => {
    renderSelector()
    fireEvent.change(screen.getByPlaceholderText(/Search markets/), { target: { value: 'over' } })
    expect(screen.getByText('Over / Under 2.5 goals')).toBeDefined()
    expect(screen.queryByText('Double chance')).toBeNull()
    expect(screen.getByText('Goals')).toBeDefined()
    expect(screen.queryByText('Results')).toBeNull()
  })

  it('shows an empty state without matches', () => {
    renderSelector()
    fireEvent.change(screen.getByPlaceholderText(/Search markets/), { target: { value: 'zzz' } })
    expect(screen.getByText('No matching markets.')).toBeDefined()
  })

  it('aligns count badges in a fixed centered cell', () => {
    const { container } = render(
      <LanguageProvider>
        <MarketSelector selected="1x2" onChange={() => {}} availableMarkets={available} />
      </LanguageProvider>,
    )
    const triggers = container.querySelectorAll('button[aria-expanded]')
    expect(triggers.length).toBeGreaterThan(1)
    triggers.forEach(trigger => {
      expect(trigger.querySelector(':scope > span.w-12')).not.toBeNull()
    })
  })
})

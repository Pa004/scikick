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

  it('opens the group containing the selected market by default', () => {
    renderSelector('ht_1x2')
    expect(screen.queryByText('Double chance')).toBeNull()
    expect(screen.getByText('1st Half')).toBeDefined()
  })

  it('keeps one group open at a time', () => {
    renderSelector()
    expect(screen.getByText('Double chance')).toBeDefined()
    fireEvent.click(screen.getByText('Goals'))
    expect(screen.queryByText('Double chance')).toBeNull()
    expect(screen.getByText('Over / Under 2.5 goals')).toBeDefined()
  })

  it('calls onChange with the market key', () => {
    const onChange = renderSelector()
    fireEvent.click(screen.getByText('Double chance'))
    expect(onChange).toHaveBeenCalledWith('double_chance')
  })
})

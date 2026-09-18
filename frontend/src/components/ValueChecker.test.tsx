import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { ValueResponse } from '../types'
import ValueChecker from './ValueChecker'

const storedResult: ValueResponse = {
  fixture_id: 1,
  source: 'best-eu',
  outcomes: {
    home: { prob: 0.269, odds: 2.88, edge: -0.224, value: false, kelly: 0 },
    draw: { prob: 0.311, odds: 3.2, edge: -0.005, value: false, kelly: 0 },
    away: { prob: 0.42, odds: 2.92, edge: 0.225, value: true, kelly: 0.029 },
  },
}

function renderChecker(autoResult?: ValueResponse | null) {
  render(
    <LanguageProvider>
      <ValueChecker fixtureId={1} home="Udinese" away="Lazio" autoResult={autoResult} />
    </LanguageProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ValueChecker odds source', () => {
  it('explains the stored slug in plain words with the multi-book note', () => {
    renderChecker(storedResult)
    expect(screen.getByText('Registered odds · best European odds')).toBeDefined()
    expect(screen.getByText('Each outcome may come from a different bookmaker.')).toBeDefined()
  })

  it('shows unknown sources raw as a fallback', () => {
    renderChecker({ ...storedResult, source: 'bet365' })
    expect(screen.getByText('Registered odds · bet365')).toBeDefined()
    expect(screen.queryByText('Each outcome may come from a different bookmaker.')).toBeNull()
  })

  it('labels sourceless results as the user odds', () => {
    renderChecker({ ...storedResult, source: null })
    expect(screen.getByText('Your odds')).toBeDefined()
  })

  it('states the suggested stake in plain words on the value row', () => {
    renderChecker(storedResult)
    expect(screen.getByText('Suggested stake: 2.9% of your bankroll')).toBeDefined()
    expect(screen.queryByText(/Kelly/)).toBeNull()
  })

  it('marks manual check results as the user odds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...storedResult, source: null }),
    })))
    renderChecker(null)
    fireEvent.change(screen.getByLabelText('Udinese'), { target: { value: '2.88' } })
    fireEvent.change(screen.getByLabelText('Draw'), { target: { value: '3.20' } })
    fireEvent.change(screen.getByLabelText('Lazio'), { target: { value: '2.92' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check value' }))
    await waitFor(() => expect(screen.getByText('Your odds')).toBeDefined())
  })
})

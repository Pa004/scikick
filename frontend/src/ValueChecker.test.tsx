import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from './i18n'
import ValueChecker from './components/ValueChecker'

function renderChecker() {
  return render(
    <LanguageProvider>
      <ValueChecker fixtureId={7} home="Arsenal" away="Chelsea" />
    </LanguageProvider>,
  )
}

const mockValue = {
  fixture_id: 7,
  outcomes: {
    home: { prob: 0.52, odds: 2.1, edge: 0.092, value: true, kelly: 0.021 },
    draw: { prob: 0.26, odds: 3.4, edge: -0.116, value: false, kelly: 0 },
    away: { prob: 0.22, odds: 3.6, edge: -0.208, value: false, kelly: 0 },
  },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ValueChecker', () => {
  it('loads stored odds automatically and shows +EV badge', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValue),
    } as Response)
    renderChecker()
    expect(await screen.findByText((_c, el) => el?.textContent === '+EV · Edge +9.2%')).toBeDefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/value')
    expect(JSON.parse(init.body as string)).toEqual({ fixture_id: 7 })
  })

  it('posts manual odds and overrides auto result', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValue),
    } as Response)
    renderChecker()

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '2.10' } })
    fireEvent.change(inputs[1], { target: { value: '3.40' } })
    fireEvent.change(inputs[2], { target: { value: '3.60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check value' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [autoUrl, autoInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(autoUrl).toContain('/api/value')
    expect(JSON.parse(autoInit.body as string)).toEqual({ fixture_id: 7 })
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toContain('/api/value')
    expect(JSON.parse(init.body as string)).toEqual({
      fixture_id: 7,
      odds: { home: 2.1, draw: 3.4, away: 3.6 },
    })
    expect(await screen.findByText((_c, el) => el?.textContent === '+EV · Edge +9.2%')).toBeDefined()
  })

  it('keeps check disabled until three valid odds', () => {
    renderChecker()
    const button = screen.getByRole('button', { name: 'Check value' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '2.10' } })
    expect(button.disabled).toBe(true)
  })
})

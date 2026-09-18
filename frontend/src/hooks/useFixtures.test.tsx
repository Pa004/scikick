import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { Fixture } from '../types'
import { useFixtures } from './useFixtures'

const fixtures: Fixture[] = [
  { id: 1, date: '2026-09-18', home: 'A', away: 'B', status: 'pre', home_score: null, away_score: null, prediction: null, league: 'E0' },
  { id: 2, date: '2026-09-19', home: 'C', away: 'D', status: 'pre', home_score: null, away_score: null, prediction: null, league: 'SP1' },
]

function Probe({ upcoming }: { upcoming: boolean }) {
  const { fixtures, loading, error, leagueCounts, retry } = useFixtures('all', 100, upcoming)
  if (loading) return <p>loading</p>
  if (error) return <p>failed<button type="button" onClick={retry}>retry</button></p>
  return (
    <div>
      <p>count:{fixtures.length}</p>
      <p>e0:{leagueCounts?.E0 ?? '?'}</p>
      <button type="button" onClick={retry}>retry</button>
    </div>
  )
}

function renderProbe(upcoming: boolean) {
  render(
    <LanguageProvider>
      <Probe upcoming={upcoming} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => (
    Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures }) })
  )))
})

describe('useFixtures', () => {
  it('loads fixtures, counts and upcoming flag', async () => {
    renderProbe(true)
    await waitFor(() => expect(screen.getByText('count:2')).toBeDefined())
    expect(screen.getByText('e0:1')).toBeDefined()
    const urls = vi.mocked(fetch).mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('upcoming=true'))).toBe(true)
  })

  it('recovers through retry after failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('down')).mockImplementation(() => (
      Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures }) })
    )))
    renderProbe(false)
    await waitFor(() => expect(screen.getByText('failed')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByText('count:2')).toBeDefined())
  })
})

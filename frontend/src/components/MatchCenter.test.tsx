import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from '../i18n'
import type { TeamContext } from '../types'
import { MatchCenter } from './MatchCenter'

const bundleHome: TeamContext = {
  team: 'Arsenal',
  form: [
    { date: '2026-09-10', opponent: 'X', result: 'W', score: '2-0' },
    { date: '2026-09-03', opponent: 'Y', result: 'W', score: '1-0' },
  ],
  h2h: { wins: 1, draws: 1, losses: 0, matches: [] },
  crest: null,
} as unknown as TeamContext

const bundleAway: TeamContext = {
  team: 'Chelsea',
  form: [{ date: '2026-09-10', opponent: 'Z', result: 'L', score: '0-1' }],
  h2h: { wins: 0, draws: 0, losses: 0, matches: [] },
  crest: null,
} as unknown as TeamContext

function renderCenter(props?: { bundleHome?: TeamContext | null; bundleAway?: TeamContext | null }) {
  render(
    <MemoryRouter>
      <LanguageProvider>
        <MatchCenter home="Arsenal" away="Chelsea" fixtures={[]} {...props} />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  window.localStorage.removeItem('scikick.locale')
  vi.unstubAllGlobals()
})

describe('MatchCenter bundle context', () => {
  it('prefers bundle form over local fixtures without fetching', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('should not fetch')
    })
    vi.stubGlobal('fetch', fetchSpy)
    renderCenter({ bundleHome, bundleAway })
    expect(await screen.findByText('Recent points')).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
    // 2 wins + draw-free window of 2 → 6 of 6 pts.
    expect(screen.getByText('6 of 6 pts · 100%')).toBeDefined()
  })

  it('falls back to local fixtures when the bundle failed', () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('should not fetch')
    })
    vi.stubGlobal('fetch', fetchSpy)
    renderCenter({ bundleHome: null, bundleAway: null })
    expect(screen.getAllByText('No past results in loaded fixtures')).toHaveLength(2)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

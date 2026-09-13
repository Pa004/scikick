import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import { OverflowMenu } from './components/layout/OverflowMenu'

// Radix Menu keeps jsdom workers hanging (focus machinery); its behavior
// is covered live in the browser. Mock the shell, test our wiring.
vi.mock('@radix-ui/react-dropdown-menu', () => {
  const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>
  return {
    Root: passthrough,
    Trigger: passthrough,
    Portal: passthrough,
    Content: ({ children, ...props }: { children: ReactNode }) => (
      <div role="menu" {...props}>{children}</div>
    ),
    Item: ({ children, onSelect, ...props }: { children: ReactNode; onSelect?: () => void }) => (
      <div role="menuitem" onClick={onSelect} {...props}>{children}</div>
    ),
    CheckboxItem: ({ children, checked, onCheckedChange, ...props }: {
      children: ReactNode; checked?: boolean; onCheckedChange?: (v: boolean) => void
    }) => (
      <div role="menuitemcheckbox" aria-checked={checked} onClick={() => onCheckedChange?.(!checked)} {...props}>
        {children}
      </div>
    ),
    ItemIndicator: passthrough,
    Label: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
    Separator: (props: object) => <hr {...props} />,
  }
})
import { clearDetailCaches } from './api/detail'
import App from './App'

const mockFixtures = [
  { id: 1, date: '2026-09-12', home: 'Arsenal', away: 'Chelsea', status: 'pre', home_score: null, away_score: null, prediction: { probabilities: { home: 0.6, draw: 0.25, away: 0.15 } }, league: 'E0' },
  { id: 2, date: '2026-09-13', home: 'Liverpool', away: 'Arsenal', status: 'pre', home_score: null, away_score: null, prediction: null, league: 'E0' },
]

function renderApp(entries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearDetailCaches()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/fixtures')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixtures: mockFixtures }) })
    if (url.includes('/predict/scorer')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/api/value')) return Promise.resolve({ ok: false, status: 404 })
    if (url.includes('/context')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ team: 'X', form: [], h2h: { wins: 0, draws: 0, losses: 0, matches: [] } }) })
    if (url.includes('/predict/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ fixture_id: 1, model_version: 'v', model_agreement: 0.8, probabilities: { '1x2': { home: 0.6, draw: 0.25, away: 0.15 } } }) })
    if (url.includes('/stats')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ total_predictions: 0, accuracy: 0, avg_confidence: 0, by_confidence_band: [], by_league: [], by_market: [], cold_start: true }) })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

describe('header', () => {
  it('shows the brand lockup linking home', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    const home = screen.getByRole('link', { name: 'SciKick home' })
    expect(home.getAttribute('href')).toBe('/')
    expect(screen.getByText('Your matchday, made clear')).toBeDefined()
  })

  it('shows the feed status with counts', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    expect(screen.getByText(/2 upcoming/)).toBeDefined()
  })

  it('renders the mobile bottom bar with four destinations', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    const bars = screen.getAllByRole('navigation', { name: 'Sections' })
    expect(bars.length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('link', { name: 'Fixtures' }).length).toBeGreaterThanOrEqual(2)
  })

  it('opens the palette with Ctrl+K', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('combobox')).toBeDefined()
  })

  it('toggles analyst mode from the overflow menu', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Analyst' }))
    expect(localStorage.getItem('scikick.analyst-mode')).toBe('1')
  })

  it('routes overflow about-item to the model opener', async () => {    const onOpenModel = vi.fn()
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <OverflowMenu analyst={false} onAnalystChange={() => {}} onOpenModel={onOpenModel} />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'About the model' }))
    expect(onOpenModel).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('opens the model drawer from the app overflow', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getByRole('menuitem', { name: 'About the model' }))
    expect(await screen.findByText('No results to calibrate yet. Check back after the matchday.')).toBeDefined()
  })
})

describe('command palette', () => {
  it('searches teams and navigates to the team page', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Search team or league' })[0])
    const box = await screen.findByRole('combobox')
    fireEvent.change(box, { target: { value: 'ars' } })
    expect(await screen.findByText('Teams')).toBeDefined()
    fireEvent.click(screen.getByRole('option', { name: 'Arsenal' }))
    expect(await screen.findByText('Upcoming')).toBeDefined()
  })

  it('searches matches and opens the story with keyboard', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Search team or league' })[0])
    const box = await screen.findByRole('combobox')
    fireEvent.change(box, { target: { value: 'chelsea' } })
    expect(await screen.findByText('Matches')).toBeDefined()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(await screen.findByText(/Arsenal win/)).toBeDefined()
  })

  it('shows empty state for unknown queries', async () => {
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Search team or league' })[0])
    const box = await screen.findByRole('combobox')
    fireEvent.change(box, { target: { value: 'zzz' } })
    expect(await screen.findByText('No results. Try another name.')).toBeDefined()
  })

  it('shows recent visits when the query is empty', async () => {
    localStorage.setItem('scikick.recent-visits', JSON.stringify([
      { kind: 'team', id: 'Arsenal', label: 'Arsenal' },
    ]))
    renderApp()
    await screen.findAllByText(/Arsenal/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Search team or league' })[0])
    await screen.findByRole('combobox')
    expect(screen.getByText('Recent')).toBeDefined()
    fireEvent.click(screen.getByRole('option', { name: 'Arsenal' }))
    expect(await screen.findByText('Upcoming')).toBeDefined()
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { LanguageProvider } from '../../i18n'
import { MatchCard, FormStrip } from './MatchCard'
import { FeedProvider } from './FeedContext'
import { SegmentedBar } from './SegmentedBar'
import { Dots10 } from '../fixtures/Dots10'
import { TeamAvatar } from './TeamAvatar'
import type { Fixture } from '../../types'

const fixture: Fixture = {
  id: 1, date: '2026-09-12', home: 'Liverpool', away: 'Fulham', status: 'pre',
  home_score: null, away_score: null,
  prediction: { probabilities: { home: 0.538, draw: 0.274, away: 0.187 } },
  league: 'E0',
}

function withFeed(children: ReactNode, onToggleFollow = vi.fn()) {
  return (
    <MemoryRouter>
      <LanguageProvider>
        <FeedProvider
          followed={[]}
          onToggleFollow={onToggleFollow}
          analyst={false}
          onAnalystChange={() => {}}
        >
          {children}
        </FeedProvider>
      </LanguageProvider>
    </MemoryRouter>
  )
}

function renderCard(expanded = false, onToggle = vi.fn(), onToggleFollow = vi.fn()) {
  return render(withFeed(
    <MatchCard
      fixture={fixture}
      expanded={expanded}
      onToggle={onToggle}
      hasValue={null}
      fixtures={[fixture]}
    />,
    onToggleFollow,
  ))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
})

describe('MatchCard', () => {
  it('exposes expand semantics and team names as heading', () => {
    renderCard()
    const toggle = screen.getByRole('button', { name: /Liverpool vs Fulham/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('heading', { name: /Liverpool vs Fulham/ })).toBeDefined()
  })

  it('shows mono 1X2 line when collapsed and legend when expanded', () => {
    const { unmount } = renderCard(false)
    const collapsed = screen.getAllByText((_c, el) => el?.tagName === 'P' && (el?.textContent ?? '').includes('54%'))
    expect(collapsed.length).toBeGreaterThan(0)
    expect(screen.getByText(/sums to 100|suman 100/)).toBeDefined()
    // collapsed has compact bar without legend
    expect(screen.queryAllByText((_c, el) => el?.tagName === 'LI' && (el?.textContent ?? '').startsWith('1 ·')).length).toBe(0)
    unmount()
    renderCard(true)
    const legend = screen.getAllByText((_c, el) => el?.tagName === 'LI' && (el?.textContent ?? '').startsWith('1 ·'))
    expect(legend.length).toBeGreaterThan(0)
    expect(legend[0].textContent).toContain('54%')
  })

  it('renders display names with diacritics', () => {
    const alaves: Fixture = {
      ...fixture, id: 9, home: 'Alaves', away: 'Espanol',
      prediction: { probabilities: { home: 0.4, draw: 0.3, away: 0.3 } },
    }
    render(withFeed(
      <MatchCard
        fixture={alaves}
        expanded={false}
        onToggle={vi.fn()}
        hasValue={null}
        fixtures={[alaves]}
      />,
    ))
    expect(screen.getByRole('heading', { name: /Alavés vs Español/ })).toBeDefined()
    const mono = screen.getAllByText((_c, el) => el?.tagName === 'P' && (el?.textContent ?? '').includes('40%'))
    expect(mono.length).toBeGreaterThan(0)
    expect(screen.getByText(/Alavés 40%/)).toBeDefined()
    expect(screen.getByText(/Español 30%/)).toBeDefined()
  })

  it('toggles follow with accessible name', () => {    const onToggleFollow = vi.fn()
    renderCard(false, vi.fn(), onToggleFollow)
    fireEvent.click(screen.getByRole('button', { name: 'Follow match' }))
    expect(onToggleFollow).toHaveBeenCalledWith('Liverpool')
  })
})

describe('MatchCard story', () => {
  const historyProps = {
    hasValue: null as boolean | null,
  }
  const withProvider = (children: ReactNode) => withFeed(children)
  const withHistory: Fixture = {
    ...fixture,
    id: 11,
    prediction: { probabilities: { home: 0.5, draw: 0.3, away: 0.2 } },
  }
  const played: Fixture = {
    ...fixture, id: 12, status: 'post', home_score: 2, away_score: 0, home: 'Liverpool', away: 'Everton',
    prediction: null,
  }

  it('keeps collapsed cards clean without form strips', () => {
    render(withProvider(
      <MatchCard
        fixture={withHistory}
        expanded={false}
        onToggle={vi.fn()}
        fixtures={[withHistory, played]}
        {...historyProps}
      />,
    ))
    expect(screen.queryByRole('img', { name: 'Liverpool: Form' })).toBeNull()
  })

  it('shows a back control when expanded', () => {
    render(withProvider(
      <MatchCard
        fixture={withHistory}
        expanded
        onToggle={vi.fn()}
        fixtures={[withHistory, played]}
        {...historyProps}
      />,
    ))
    expect(screen.getByRole('button', { name: 'Back to matches' })).toBeDefined()
  })
})

describe('FormStrip', () => {
  it('renders letter pips with text labels, not color alone', () => {
    render(
      <LanguageProvider>
        <FormStrip form={['W', 'D', 'L']} label="Liverpool: Form" />
      </LanguageProvider>,
    )
    expect(screen.getByRole('img', { name: 'Liverpool: Form' })).toBeDefined()
    expect(screen.getByText('W')).toBeDefined()
    expect(screen.getByText('D')).toBeDefined()
    expect(screen.getByText('L')).toBeDefined()
  })

  it('localizes pips to V/E/D in Spanish', () => {
    window.localStorage.setItem('scikick.locale', 'es')
    render(
      <LanguageProvider>
        <FormStrip form={['W', 'D', 'L']} label="Liverpool: Forma" />
      </LanguageProvider>,
    )
    expect(screen.getByText('V')).toBeDefined()
    expect(screen.getAllByText('E').length).toBeGreaterThan(0)
    window.localStorage.removeItem('scikick.locale')
  })

  it('renders nothing without form', () => {
    const { container } = render(
      <LanguageProvider>
        <FormStrip form={[]} label="None: Form" />
      </LanguageProvider>,
    )
    expect(container.textContent).toBe('')
  })
})

describe('SegmentedBar', () => {
  it('labels every segment for assistive tech', () => {
    render(
      <LanguageProvider>
        <SegmentedBar probs={{ home: 0.5, draw: 0.3, away: 0.2 }} home="A" away="B" onSelect={vi.fn()} />
      </LanguageProvider>,
    )
    expect(screen.getByLabelText('1 · A: 50.0%')).toBeDefined()
    expect(screen.getByLabelText('X · Draw: 30.0%')).toBeDefined()
  })

  it('explains the 1X2 codes under the legend', () => {
    render(
      <LanguageProvider>
        <SegmentedBar probs={{ home: 0.5, draw: 0.3, away: 0.2 }} home="A" away="B" onSelect={vi.fn()} />
      </LanguageProvider>,
    )
    expect(screen.getByText('1 = home win · X = draw · 2 = away win')).toBeDefined()
  })

  it('uses semantic 1X2 fills without presentation wrapper', () => {
    const { container } = render(
      <LanguageProvider>
        <SegmentedBar probs={{ home: 0.5, draw: 0.3, away: 0.2 }} home="A" away="B" onSelect={vi.fn()} />
      </LanguageProvider>,
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].className).toContain('bg-primary')
    expect(buttons[1].className).toContain('bg-surface-alt')
    expect(buttons[2].className).toContain('bg-danger')
    expect(container.querySelector('[role="presentation"]')).toBeNull()
  })
})

describe('Dots10', () => {
  it('renders ten dots with the verdict label', () => {
    const { container } = render(<Dots10 filled={6} label="Liverpool win 6 in 10" />)
    expect(screen.getByRole('img', { name: 'Liverpool win 6 in 10' })).toBeDefined()
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBe(10)
  })
})

describe('TeamAvatar', () => {
  it('falls back to initials without layout shift', () => {
    const { container } = render(<TeamAvatar team="Liverpool" crest={null} />)
    expect(container.textContent).toBe('LI')
  })

  it('renders the crest image when provided', () => {
    render(<TeamAvatar team="Liverpool" crest="https://x.test/liv.png" />)
    const img = document.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://x.test/liv.png')
    expect(img?.getAttribute('loading')).toBe('lazy')
  })
})

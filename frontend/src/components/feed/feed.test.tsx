import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from '../../i18n'
import { MatchCard } from './MatchCard'
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

function renderCard(expanded = false, onToggle = vi.fn()) {
  return render(
    <LanguageProvider>
      <MatchCard
        fixture={fixture}
        expanded={expanded}
        onToggle={onToggle}
        leagueName="Premier League"
        followed={[]}
        onToggleFollow={vi.fn()}
        hasValue={null}
        analyst={false}
        fixtures={[fixture]}
      />
    </LanguageProvider>,
  )
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

  it('shows segmented 1X2 legend with percentages', () => {
    renderCard()
    expect(screen.getByText('1 · 54%')).toBeDefined()
    expect(screen.getByText('X · 27%')).toBeDefined()
    expect(screen.getByText('2 · 19%')).toBeDefined()
  })

  it('toggles follow with accessible name', () => {
    const onToggleFollow = vi.fn()
    render(
      <LanguageProvider>
        <MatchCard
          fixture={fixture}
          expanded={false}
          onToggle={vi.fn()}
          leagueName="Premier League"
          followed={[]}
          onToggleFollow={onToggleFollow}
          hasValue={null}
          analyst={false}
          fixtures={[fixture]}
        />
      </LanguageProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Follow Liverpool / Fulham' }))
    expect(onToggleFollow).toHaveBeenCalledWith('Liverpool', 'Fulham')
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

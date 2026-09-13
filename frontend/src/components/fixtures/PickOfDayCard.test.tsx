import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from '../../i18n'
import { PickOfDayCard } from './PickOfDayCard'
import type { DayPick } from '../../utils/matchCenter'

const pick: DayPick = {
  fixtureId: 7,
  home: 'Athletic Bilbao',
  away: 'Elche',
  league: 'SP1',
  date: '2026-09-12',
  outcome: 'home',
  prob: 0.689,
}

function renderPick() {
  return render(
    <LanguageProvider>
      <PickOfDayCard pick={pick} leagueName={() => 'La Liga'} onSelect={vi.fn()} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('PickOfDayCard', () => {
  it('dismisses until tomorrow and persists', () => {
    renderPick()
    expect(screen.getByText(/Athletic Bilbao/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: "Dismiss today's pick" }))
    expect(screen.queryByText(/Athletic Bilbao/)).toBeNull()
    expect(localStorage.getItem('scikick.pick-dismissed')).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/)
  })

  it('stays hidden on remount the same day', () => {
    const { unmount } = renderPick()
    fireEvent.click(screen.getByRole('button', { name: "Dismiss today's pick" }))
    unmount()
    renderPick()
    expect(screen.queryByText(/Athletic Bilbao/)).toBeNull()
  })
})

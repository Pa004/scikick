import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useFollowedTeams } from './hooks/useFollowedTeams'
import { getDeepLinkedFixtureId, syncDeepLink } from './lib/deeplink'
import { LanguageProvider } from './i18n'

function Harness() {
  const { followed, toggle } = useFollowedTeams()
  return (
    <div>
      <span data-testid="followed">{followed.join(',')}</span>
      <button type="button" onClick={() => toggle('Arsenal')}>toggle</button>
    </div>
  )
}

describe('useFollowedTeams', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('toggles and persists teams', () => {
    render(
      <LanguageProvider>
        <Harness />
      </LanguageProvider>,
    )
    expect(screen.getByTestId('followed').textContent).toBe('')
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('followed').textContent).toBe('Arsenal')
    expect(JSON.parse(localStorage.getItem('scikick.followed-teams') ?? '[]')).toEqual(['Arsenal'])
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('followed').textContent).toBe('')
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('scikick.followed-teams', 'not-json')
    render(
      <LanguageProvider>
        <Harness />
      </LanguageProvider>,
    )
    expect(screen.getByTestId('followed').textContent).toBe('')
  })
})

describe('deeplink', () => {
  it('parses and syncs ?partido= without reloads', () => {
    window.history.replaceState(null, '', '/?partido=42')
    expect(getDeepLinkedFixtureId()).toBe(42)
    act(() => {
      syncDeepLink(null)
    })
    expect(window.location.search).toBe('')
    expect(getDeepLinkedFixtureId()).toBeNull()
    window.history.replaceState(null, '', '/')
  })

  it('rejects invalid ids', () => {
    window.history.replaceState(null, '', '/?partido=abc')
    expect(getDeepLinkedFixtureId()).toBeNull()
    window.history.replaceState(null, '', '/')
  })
})

import { useState, useEffect, useRef } from 'react'
import type { Fixture } from './types'
import { fetchFixtures } from './api'
import { useLanguage } from './i18n'
import { useAnalystMode } from './hooks/useAnalystMode'
import { useFollowedTeams } from './hooks/useFollowedTeams'
import { AppShell } from './components/layout/AppShell'
import { LEAGUES } from './components/layout/LeagueSwitcher'
import { FeedBoard } from './components/feed/FeedBoard'
import { ModelDrawer } from './components/feed/ModelDrawer'
import { Button } from './components/ui/button'

function App() {
  const { t } = useLanguage()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [league, setLeague] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [analyst, setAnalyst] = useAnalystMode()
  const { followed, toggle } = useFollowedTeams()

  const leagueRequestId = useRef(0)

  // Fixtures depend on league only: market and drawer data never
  // collapse the feed into skeletons.
  useEffect(() => {
    const requestId = ++leagueRequestId.current
    const wantLeague = league === '' ? 'all' : league
    setLoading(true)
    setError(false)

    fetchFixtures(wantLeague, league === '' ? 100 : 30)
      .then(data => {
        if (requestId !== leagueRequestId.current) return
        setFixtures(data)
        setLoading(false)
      })
      .catch(() => {
        if (requestId !== leagueRequestId.current) return
        setFixtures([])
        setLoading(false)
        setError(true)
      })
  }, [league, attempt])

  const handleLeagueChange = (value: string) => {
    setLeague(value)
  }

  const handleToggleFollow = (team: string) => {
    toggle(team)
  }

  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  return (
    <AppShell
      league={league}
      onLeagueChange={handleLeagueChange}
      analyst={analyst}
      onAnalystChange={setAnalyst}
      actions={<ModelDrawer league={league} />}
    >
      <main id="main-content">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          {t('fixtures')}
        </h2>
        {error ? (
          <div
            role="alert"
            className="animate-fade rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            <p className="mb-2 font-medium">{t('backendError')}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAttempt(a => a + 1)}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <FeedBoard
            key={league}
            fixtures={fixtures}
            loading={loading}
            leagueName={leagueName}
            followed={followed}
            onToggleFollow={handleToggleFollow}
            analyst={analyst}
            fixturesForContext={fixtures}
          />
        )}
      </main>
    </AppShell>
  )
}

export default App

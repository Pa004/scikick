import { useState, useEffect, useRef } from 'react'
import { Route, Routes } from 'react-router'
import type { Fixture } from './types'
import { fetchFixtures } from './api'
import { useLanguage } from './i18n'
import { useAnalystMode } from './hooks/useAnalystMode'
import { useFollowedTeams } from './hooks/useFollowedTeams'
import { AppShell } from './components/layout/AppShell'
import { LEAGUES } from './components/layout/LeagueSwitcher'
import { FeedPage } from './pages/FeedPage'
import { MatchPage } from './pages/MatchPage'
import { TeamPage } from './pages/TeamPage'
import { FollowedPage } from './pages/FollowedPage'
import { NotFound } from './pages/NotFound'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { ModelDrawer } from './components/feed/ModelDrawer'

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
      <ScrollToTop />
      <Routes>
        <Route
          path="/"
          element={
            <FeedPage
              key={league}
              fixtures={fixtures}
              loading={loading}
              error={error}
              onRetry={() => setAttempt(a => a + 1)}
              leagueName={leagueName}
              followed={followed}
              onToggleFollow={toggle}
              analyst={analyst}
            />
          }
        />
        <Route path="/partido/:id" element={<MatchPage />} />
        <Route path="/equipo/:name" element={<TeamPage />} />
        <Route path="/seguidos" element={<FollowedPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}

export default App

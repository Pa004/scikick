import { useState, useEffect } from 'react'
import { Route, Routes } from 'react-router'
import { useLanguage } from './i18n'
import { useAnalystMode } from './hooks/useAnalystMode'
import { useFixtures } from './hooks/useFixtures'
import { useFollowedTeams } from './hooks/useFollowedTeams'
import { useLeagueName } from './hooks/useLeagueName'
import { AppShell } from './components/layout/AppShell'
import { FeedPage } from './pages/FeedPage'
import { MatchPage } from './pages/MatchPage'
import { TeamPage } from './pages/TeamPage'
import { FollowedPage } from './pages/FollowedPage'
import { NotFound } from './pages/NotFound'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { ModelDrawer } from './components/feed/ModelDrawer'
import { CommandPalette } from './components/search/CommandPalette'
import { getCachedValue, prefetchValues } from './api/detail'

function App() {
  const { t } = useLanguage()
  const [league, setLeague] = useState('')
  const [analyst, setAnalyst] = useAnalystMode()
  const [modelOpen, setModelOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { followed, toggle } = useFollowedTeams()
  const [showValue, setShowValue] = useState(false)
  const [valueCount, setValueCount] = useState(0)
  const [showPast, setShowPast] = useState(false)
  const leagueName = useLeagueName()

  // Fixtures depend on league only: market and drawer data never
  // collapse the feed into skeletons.
  const {
    fixtures, loading, error, fetchedAt, leagueCounts, retry,
  } = useFixtures(league === '' ? 'all' : league, league === '' ? 100 : 30, !showPast)

  // Value pill count — best-effort background check for current league fixtures
  useEffect(() => {
    if (fixtures.length === 0) {
      setValueCount(0)
      return
    }
    let cancelled = false
    const ranked = [...fixtures]
      .sort((a, b) => Number(b.prediction != null) - Number(a.prediction != null))
      .slice(0, 15)
      .map(f => f.id)
    void prefetchValues(ranked).then(() => {
      if (cancelled) return
      const count = fixtures.filter(f => {
        const e = getCachedValue(f.id)
        return e != null && Object.values(e.outcomes).some(o => o.value)
      }).length
      setValueCount(count)
    })
    return () => {
      cancelled = true
    }
  }, [fixtures])

  const handleLeagueChange = (value: string) => {
    setLeague(value)
  }

  // Global command palette shortcut (Ctrl/⌘+K), skipped while typing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const target = e.target as HTMLElement | null
        const typing = target !== null && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
        if (typing) return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <AppShell
      league={league}
      onLeagueChange={handleLeagueChange}
      analyst={analyst}
      onAnalystChange={setAnalyst}
      onOpenModel={() => setModelOpen(true)}
      onOpenSearch={() => setSearchOpen(true)}
      searchLabel={t('searchCommand')}
      statusCount={fixtures.length}
      statusUpdatedAt={fetchedAt}
      leagueCounts={leagueCounts}
      savedCount={followed.length}
      showValue={showValue}
      onShowValueChange={setShowValue}
      valueCount={valueCount}
      showPast={showPast}
      onShowPastChange={setShowPast}
      actions={
        <>
          <ModelDrawer league={league} open={modelOpen} onOpenChange={setModelOpen} />
          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        </>
      }
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
              onRetry={retry}
              leagueName={leagueName}
              followed={followed}
              onToggleFollow={toggle}
              analyst={analyst}
              showValue={showValue}
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

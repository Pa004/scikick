import { useState, useEffect, useRef, useMemo } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData, ScorerPrediction } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration, fetchScorer } from './api'
import { useLanguage } from './i18n'
import { selectPickOfDay } from './utils/matchCenter'
import { matchesQuery } from './components/fixtures/fixtureUtils'
import { useAnalystMode } from './hooks/useAnalystMode'
import { AppShell } from './components/layout/AppShell'
import { LEAGUES } from './components/layout/LeagueSwitcher'
import { FixturesBoard } from './components/fixtures/FixturesBoard'
import { PickOfDayCard } from './components/fixtures/PickOfDayCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import PredictionPanel from './components/PredictionPanel'
import ScorerPanel from './components/ScorerPanel'
import StatsDashboard from './components/StatsDashboard'

type ViewTab = 'match' | 'scorer'

function App() {
  const { t } = useLanguage()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMarket, setSelectedMarket] = useState('1x2')
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [scorer, setScorer] = useState<ScorerPrediction | null>(null)
  const [scorerFailed, setScorerFailed] = useState(false)
  const [activeTab, setActiveTab] = useState<ViewTab>('match')
  const [stats, setStats] = useState<Stats | null>(null)
  const [matchdayData, setMatchdayData] = useState<MatchdayData | null>(null)
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [league, setLeague] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [analyst, setAnalyst] = useAnalystMode()

  const leagueRequestId = useRef(0)

  const visibleFixtures = useMemo(
    () => fixtures.filter(f => matchesQuery(f, searchQuery)),
    [fixtures, searchQuery],
  )

  const showFeatured = league === '' && searchQuery.trim() === ''

  // Predicted fixtures first so the Featured rail shows actionable rows.
  const featured = useMemo(() => {
    const ranked = [...visibleFixtures].sort(
      (a, b) => Number(b.prediction != null) - Number(a.prediction != null),
    )
    return ranked.slice(0, 5)
  }, [visibleFixtures])

  const rest = useMemo(() => {
    const ids = new Set(featured.map(f => f.id))
    return visibleFixtures.filter(f => !ids.has(f.id))
  }, [visibleFixtures, featured])

  const hasPrediction = selectedFixture !== null && prediction !== null
  const pick = useMemo(() => selectPickOfDay(visibleFixtures), [visibleFixtures])
  const selected = fixtures.find(f => f.id === selectedFixture)

  useEffect(() => {
    const requestId = ++leagueRequestId.current
    const wantLeague = league === '' ? 'all' : league

    fetchFixtures(wantLeague, league === '' ? 100 : 30)
      .then(data => {
        if (requestId !== leagueRequestId.current) return
        setFixtures(data)
        setLoading(false)
      })
      .catch(() => {
        if (requestId !== leagueRequestId.current) return
        setLoading(false)
        setError('backendError')
      })

    fetchStats(selectedMarket, league || undefined)
      .then(data => {
        if (requestId !== leagueRequestId.current) return
        setStats(data)
      })
      .catch(() => {})

    fetchMatchdayStats(selectedMarket, league || undefined)
      .then(data => {
        if (requestId !== leagueRequestId.current) return
        setMatchdayData(data)
      })
      .catch(() => {})

    fetchCalibration(selectedMarket, league || undefined)
      .then(data => {
        if (requestId !== leagueRequestId.current) return
        setCalibrationData(data)
      })
      .catch(() => {})
  }, [league, selectedMarket])

  useEffect(() => {
    if (!selectedFixture) return
    let active = true
    setPrediction(null)
    setScorer(null)
    setScorerFailed(false)
    fetchPrediction(selectedFixture)
      .then(data => {
        if (active) setPrediction(data)
      })
      .catch(() => {
        if (active) setPrediction(null)
      })
    fetchScorer(selectedFixture)
      .then(data => {
        if (active) setScorer(data)
      })
      .catch(() => {
        if (active) {
          setScorer(null)
          setScorerFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [selectedFixture])

  const resetLeagueData = () => {
    setFixtures([])
    setPrediction(null)
    setScorer(null)
    setStats(null)
    setMatchdayData(null)
    setCalibrationData(null)
    setLoading(true)
    setError(null)
  }

  const handleLeagueChange = (value: string) => {
    setLeague(value)
    setSelectedFixture(null)
    resetLeagueData()
  }

  const handleMarketChange = (market: string) => {
    setSelectedMarket(market)
    resetLeagueData()
  }

  const handleFixtureChange = (id: number | null) => {
    setSelectedFixture(id)
    if (!id) {
      setPrediction(null)
      setScorer(null)
    }
  }

  const handleToggleFixture = (id: number) => {
    handleFixtureChange(selectedFixture === id ? null : id)
  }

  const handleOddsClick = (id: number) => {
    handleFixtureChange(id)
    if (selectedMarket !== '1x2') handleMarketChange('1x2')
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
    >
      {error && (
        <div
          role="alert"
          className="animate-fade mb-6 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {t(error as 'backendError')}
        </div>
      )}

      {!error && (
        <main id="main-content" className="grid gap-8 lg:grid-cols-2">
          <FixturesBoard
            fixtures={visibleFixtures}
            featured={featured}
            rest={rest}
            showFeatured={showFeatured}
            loading={loading}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            selectedId={selectedFixture}
            leagueName={leagueName}
            onToggle={handleToggleFixture}
            onOddsClick={handleOddsClick}
          />

          <div>
            <Tabs
              value={activeTab}
              onValueChange={v => setActiveTab(v as ViewTab)}
            >
              <TabsList aria-label={t('prediction')}>
                <TabsTrigger
                  value="match"
                  disabled={!hasPrediction}
                  aria-describedby={hasPrediction ? undefined : 'view-tabs-hint'}
                >
                  {t('match')}
                </TabsTrigger>
                <TabsTrigger
                  value="scorer"
                  disabled={!hasPrediction}
                  aria-describedby={hasPrediction ? undefined : 'view-tabs-hint'}
                >
                  {t('goalscorer')}
                </TabsTrigger>
              </TabsList>
              <span id="view-tabs-hint" className="sr-only">
                {t('tabsHintDisabled')}
              </span>
              {hasPrediction ? (
                <>
                  <TabsContent value="match">
                    <PredictionPanel
                      prediction={prediction}
                      selectedMarket={selectedMarket}
                      onMarketChange={handleMarketChange}
                      home={selected?.home ?? ''}
                      away={selected?.away ?? ''}
                      fixtures={fixtures}
                      analyst={analyst}
                    />
                  </TabsContent>
                  <TabsContent value="scorer">
                    {scorer ? (
                      <ScorerPanel key={scorer.fixture_id} scorer={scorer} />
                    ) : scorerFailed ? (
                      <p className="text-sm text-faint">{t('scorerFailed')}</p>
                    ) : (
                      <p className="text-sm text-faint">{t('loadingScorer')}</p>
                    )}
                  </TabsContent>
                </>
              ) : (
                <div className="animate-fade">
                  {!selectedFixture && (
                    <p className="mb-4 text-sm text-faint">{t('selectFixture')}</p>
                  )}
                  <PickOfDayCard
                    pick={pick}
                    leagueName={leagueName}
                    onSelect={id => handleFixtureChange(id)}
                  />
                  {stats ? (
                    <StatsDashboard
                      stats={stats}
                      matchdayData={matchdayData}
                      calibrationData={calibrationData}
                      selectedMarket={selectedMarket}
                    />
                  ) : (
                    <p className="text-sm text-faint">
                      {selectedFixture ? t('loading') : t('selectFixture')}
                    </p>
                  )}
                </div>
              )}
            </Tabs>
          </div>
        </main>
      )}
    </AppShell>
  )
}

export default App

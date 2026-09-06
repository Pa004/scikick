import { useState, useEffect, useRef, useMemo } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData, ScorerPrediction } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration, fetchScorer } from './api'
import { useLanguage } from './i18n'
import { selectPickOfDay } from './utils/matchCenter'
import { handleSpotlightMove } from './utils/spotlight'
import PredictionPanel from './components/PredictionPanel'
import ScorerPanel from './components/ScorerPanel'
import StatsDashboard from './components/StatsDashboard'
import { LanguageSelector } from './components/LanguageSelector'

const LEAGUES = [
  { code: '', labelKey: 'allLeagues' },
  { code: 'E0', labelKey: 'premierLeague' },
  { code: 'SP1', labelKey: 'laLiga' },
  { code: 'D1', labelKey: 'bundesliga' },
  { code: 'I1', labelKey: 'serieA' },
  { code: 'F1', labelKey: 'ligue1' },
] as const

type ViewTab = 'match' | 'scorer'

interface OutcomeProbs {
  home: number
  draw: number
  away: number
}

// Stored fixture predictions carry { probabilities: { home, draw, away } }.
// Narrow the untyped record so 1X2 cells degrade to '—' instead of crashing.
function getFixture1x2(f: Fixture): OutcomeProbs | null {
  const raw = f.prediction?.['probabilities']
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  const { home, draw, away } = rec
  if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') return null
  return { home, draw, away }
}

function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

function matchesQuery(f: Fixture, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(q)
}

function App() {
  const { t } = useLanguage()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMarket, setSelectedMarket] = useState('1x2')
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [scorer, setScorer] = useState<ScorerPrediction | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('match')
  const [stats, setStats] = useState<Stats | null>(null)
  const [matchdayData, setMatchdayData] = useState<MatchdayData | null>(null)
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [league, setLeague] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const leagueRequestId = useRef(0)

  const visibleFixtures = useMemo(
    () => fixtures.filter(f => matchesQuery(f, searchQuery)),
    [fixtures, searchQuery],
  )

  const showRails = league === '' && searchQuery.trim() === ''

  // Predicted fixtures first so the Featured rail shows actionable rows.
  const featured = useMemo(() => {
    const ranked = [...visibleFixtures].sort(
      (a, b) => Number(b.prediction != null) - Number(a.prediction != null),
    )
    return ranked.slice(0, 5)
  }, [visibleFixtures])

  const rails = LEAGUES.filter(l => l.code !== '')
    .map(l => ({
      code: l.code,
      labelKey: l.labelKey,
      fixtures: visibleFixtures.filter(f => f.league === l.code),
    }))
    .filter(g => g.fixtures.length > 0)

  useEffect(() => {
    const requestId = ++leagueRequestId.current

    fetchFixtures(league || undefined)
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
        if (active) setScorer(null)
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

  const renderPickOfDay = () => {
    const pick = selectPickOfDay(visibleFixtures)
    if (!pick) {
      return (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('pickOfDayEmpty')}</p>
      )
    }
    const label = pick.outcome === 'home' ? t('home') : pick.outcome === 'draw' ? t('draw') : t('away')
    return (
      <button
        type="button"
        onClick={() => handleFixtureChange(pick.fixtureId)}
        className="card-flat pick-day spotlight-card"
        onMouseMove={handleSpotlightMove}
        style={{ padding: '1rem', marginBottom: '1rem' }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
          {t('pickOfDay')}
        </div>
        <div style={{ fontWeight: 600 }}>
          {pick.home} vs {pick.away}
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {pick.league}</span>
        </div>
        <span className="badge badge-accent" style={{ marginTop: '0.375rem', display: 'inline-block' }}>
          {label} {(pick.prob * 100).toFixed(1)}%
        </span>
      </button>
    )
  }

  const selected = fixtures.find(f => f.id === selectedFixture)

  const handleOddsClick = (id: number) => {
    handleFixtureChange(id)
    if (selectedMarket !== '1x2') handleMarketChange('1x2')
  }

  const renderOddsCells = (f: Fixture) => {
    const probs = getFixture1x2(f)
    const fav = !probs ? null : probs.home >= probs.draw && probs.home >= probs.away
      ? 'home'
      : probs.draw >= probs.away ? 'draw' : 'away'
    const cells = [
      { key: 'home', label: t('home') },
      { key: 'draw', label: t('draw') },
      { key: 'away', label: t('away') },
    ] as const
    return cells.map(c => (
      <button
        key={c.key}
        type="button"
        disabled={!probs}
        onClick={() => handleOddsClick(f.id)}
        aria-label={`${f.home} vs ${f.away} — ${c.label}${probs ? ` ${formatPct(probs[c.key])}` : ''}`}
        className={`odds-cell${fav === c.key ? ' odds-cell-fav' : ''}`}
      >
        {probs ? formatPct(probs[c.key]) : '—'}
      </button>
    ))
  }

  const renderGridHeader = () => (
    <div role="row" className="fixtures-header">
      <span>{t('fixtures')}</span>
      <span><span role="img" aria-label={t('home')}>1</span></span>
      <span><span role="img" aria-label={t('draw')}>X</span></span>
      <span><span role="img" aria-label={t('away')}>2</span></span>
    </div>
  )

  const renderFixtureRow = (f: Fixture) => {
    const isActive = selectedFixture === f.id
    return (
      <div key={f.id} role="row" data-active={isActive} className="fixture-row-grid">
        <button
          type="button"
          onClick={() => handleFixtureChange(isActive ? null : f.id)}
          aria-pressed={isActive}
          className="row-main"
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {f.date} · {f.league}
              </span>
              <span style={{ fontWeight: 500 }}>
                {f.home} vs {f.away}
                {f.home_score !== null && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                    {f.home_score} - {f.away_score}
                  </span>
                )}
              </span>
            </span>
            {f.prediction != null && (
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>{t('predicted')}</span>
            )}
          </span>
        </button>
        {renderOddsCells(f)}
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', letterSpacing: '-0.03em' }}>SciKick</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('tagline')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span id="league-tabs-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('league')}
            </span>
            <div role="group" aria-labelledby="league-tabs-label" className="league-tabs">
              {LEAGUES.map(l => (
                <button
                  key={l.code}
                  type="button"
                  aria-pressed={league === l.code}
                  onClick={() => handleLeagueChange(l.code)}
                  className="league-tab"
                >
                  {t(l.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="animate-fade-in"
          style={{
            color: 'var(--danger)',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius)',
            marginBottom: '1.5rem',
          }}
        >
          {t(error as 'backendError')}
        </div>
      )}

      {!error && (
        <main className="app-grid">
          <div>
            <h2 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('fixtures')}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchFixtures')}
                aria-label={t('searchFixtures')}
                className="search-input"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="league-tab">
                  {t('clearSearch')}
                </button>
              )}
            </div>
            {loading ? (
              <div role="status" aria-label={t('loading')}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton skeleton-row" />
                ))}
              </div>
            ) : visibleFixtures.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                {searchQuery.trim() ? t('noSearchResults') : t('noFixtures')}
              </p>
            ) : showRails ? (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <h3 className="rail-title">{t('featured')}</h3>
                <div className="fixtures-grid" role="table" aria-label={t('featured')}>
                  {renderGridHeader()}
                  {featured.map(f => renderFixtureRow(f))}
                </div>
                {rails.map(g => (
                  <div key={g.code}>
                    <h3 className="rail-title">{t(g.labelKey)}</h3>
                    <div className="fixtures-grid" role="table" aria-label={t(g.labelKey)}>
                      {renderGridHeader()}
                      {g.fixtures.map(f => renderFixtureRow(f))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fixtures-grid" role="table" aria-label={t('fixtures')} style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {renderGridHeader()}
                {visibleFixtures.map(f => renderFixtureRow(f))}
              </div>
            )}
          </div>

          <div>
            {selectedFixture && prediction ? (
              <div className="animate-fade-in">
                <div role="group" aria-label={t('prediction')} style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
                  <button
                    aria-pressed={activeTab === 'match'}
                    className={activeTab === 'match' ? 'tab-active' : ''}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      border: 'none',
                      borderBottom: activeTab === 'match' ? 'none' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === 'match' ? undefined : 'var(--text-muted)',
                      fontWeight: activeTab === 'match' ? 500 : 400,
                      fontSize: '0.9rem',
                      position: 'relative',
                    }}
                    onClick={() => setActiveTab('match')}
                  >
                    {t('match')}
                  </button>
                  <button
                    aria-pressed={activeTab === 'scorer'}
                    className={activeTab === 'scorer' ? 'tab-active' : ''}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      border: 'none',
                      borderBottom: activeTab === 'scorer' ? 'none' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === 'scorer' ? undefined : 'var(--text-muted)',
                      fontWeight: activeTab === 'scorer' ? 500 : 400,
                      fontSize: '0.9rem',
                      position: 'relative',
                    }}
                    onClick={() => setActiveTab('scorer')}
                  >
                    {t('goalscorer')}
                  </button>
                </div>
                {activeTab === 'match' ? (
                  <PredictionPanel
                    prediction={prediction}
                    selectedMarket={selectedMarket}
                    onMarketChange={handleMarketChange}
                    home={selected?.home ?? ''}
                    away={selected?.away ?? ''}
                    fixtures={fixtures}
                  />
                ) : scorer ? (
                  <ScorerPanel key={scorer.fixture_id} scorer={scorer} />
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>{t('loadingScorer')}</p>
                )}
              </div>
            ) : stats ? (
              <div className="animate-fade-in">
                {renderPickOfDay()}
                <StatsDashboard
                  stats={stats}
                  matchdayData={matchdayData}
                  calibrationData={calibrationData}
                  selectedMarket={selectedMarket}
                />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>{t('selectFixture')}</p>
            )}
          </div>
        </main>
      )}
      <footer className="app-footer">
        <span>{t('disclaimer')}</span>
      </footer>
    </div>
  )
}

export default App

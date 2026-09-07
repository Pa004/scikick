import { useState, useEffect, useRef, useMemo } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData, ScorerPrediction } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration, fetchScorer } from './api'
import { useLanguage } from './i18n'
import { selectPickOfDay, extract1x2 } from './utils/matchCenter'
import { handleSpotlightMove } from './utils/spotlight'
import { useAnalystMode } from './hooks/useAnalystMode'
import AnalystToggle from './components/AnalystToggle'
import { getVerdict, formatFrequency, formatHumanDate } from './utils/verdict'
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

function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

function matchesQuery(f: Fixture, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(q)
}

function App() {
  const { t, locale } = useLanguage()
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

  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  const renderVerdict = (f: Fixture) => {
    const probs = extract1x2(f.prediction)
    if (!probs) return null
    const v = getVerdict(f.home, f.away, probs)
    const n = String(formatFrequency(v.prob))
    const text = v.outcome === 'draw'
      ? t('verdictDraw').replace('{n}', n)
      : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', n)
    return (
      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {text}
      </span>
    )
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
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {leagueName(pick.league)}</span>
        </div>
        <span className="badge badge-accent" style={{ marginTop: '0.375rem', display: 'inline-block' }}>
          {label} {(pick.prob * 100).toFixed(1)}% · {t('frequencyInTen').replace('{n}', String(formatFrequency(pick.prob)))}
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
    const probs = extract1x2(f.prediction)
    const fav = !probs ? null : probs.home >= probs.draw && probs.home >= probs.away
      ? 'home'
      : probs.draw >= probs.away ? 'draw' : 'away'
    const cells = [
      { key: 'home', label: t('home') },
      { key: 'draw', label: t('draw') },
      { key: 'away', label: t('away') },
    ] as const
    return cells.map(c => (
      <span key={c.key} role="cell" style={{ display: 'contents' }}>
      <button
        type="button"
        disabled={!probs}
        onClick={() => handleOddsClick(f.id)}
        aria-label={`${f.home} vs ${f.away} — ${c.label}${probs ? ` ${formatPct(probs[c.key])}` : ''}${fav === c.key ? ` · ${t('favorite')}` : ''}`}
        title={probs ? undefined : t('oddsMissing')}
        className={`odds-cell${fav === c.key ? ' odds-cell-fav' : ''}`}
      >
        {probs ? formatPct(probs[c.key]) : '—'}
      </button>
      </span>
    ))
  }

  const renderGridHeader = () => (
    <div role="row" className="fixtures-header">
      <span role="columnheader">{t('fixtures')}</span>
      <span role="columnheader">
        <span aria-hidden="true">1</span>
        <span className="sr-only">{t('home')}</span>
      </span>
      <span role="columnheader">
        <span aria-hidden="true">X</span>
        <span className="sr-only">{t('draw')}</span>
      </span>
      <span role="columnheader">
        <span aria-hidden="true">2</span>
        <span className="sr-only">{t('away')}</span>
      </span>
    </div>
  )

  const renderFixtureRow = (f: Fixture) => {
    const isActive = selectedFixture === f.id
    return (
      <div key={f.id} role="row" data-active={isActive} className="fixture-row-grid">
        <span role="cell" style={{ display: 'contents' }}>
        <button
          type="button"
          onClick={() => handleFixtureChange(isActive ? null : f.id)}
          aria-pressed={isActive}
          className="row-main"
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {formatHumanDate(f.date, locale)} · {leagueName(f.league)}
              </span>
              <span style={{ fontWeight: 500 }}>
                {f.home} vs {f.away}
                {f.home_score !== null && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                    {f.home_score} - {f.away_score}
                  </span>
                )}
              </span>
              {renderVerdict(f)}
            </span>
            {f.prediction != null && (
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>{t('predicted')}</span>
            )}
          </span>
        </button>
        </span>
        {renderOddsCells(f)}
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <a href="#main-content" className="skip-link">{t('skipToContent')}</a>
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
          <AnalystToggle analyst={analyst} onChange={setAnalyst} />
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
        <main id="main-content" className="app-grid">
          <div>
            <h2 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('fixtures')}</h2>
            <div role="search" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
            ) : showFeatured ? (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <h3 className="rail-title">{t('featured')}</h3>
                <div className="fixtures-grid" role="table" aria-label={t('featured')}>
                  {renderGridHeader()}
                  {featured.map(f => renderFixtureRow(f))}
                </div>
                <div className="fixtures-grid" role="table" aria-label={t('fixtures')} style={{ marginTop: '1rem' }}>
                  {renderGridHeader()}
                  {rest.map(f => renderFixtureRow(f))}
                </div>
              </div>
            ) : (
              <div className="fixtures-grid" role="table" aria-label={t('fixtures')} style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {renderGridHeader()}
                {visibleFixtures.map(f => renderFixtureRow(f))}
              </div>
            )}
          </div>

          <div>
            <div
              role="tablist"
              aria-label={t('prediction')}
              onKeyDown={e => {
                if (!hasPrediction) return
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                setActiveTab(prev => (prev === 'match' ? 'scorer' : 'match'))
              }}
              style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}
            >
              <button
                role="tab"
                id="tab-match"
                aria-selected={activeTab === 'match'}
                aria-controls="panel-match"
                aria-describedby={hasPrediction ? undefined : 'view-tabs-hint'}
                disabled={!hasPrediction}
                className={activeTab === 'match' ? 'tab-active' : ''}
                style={{
                  padding: '0.5rem 1rem',
                  cursor: hasPrediction ? 'pointer' : 'default',
                  opacity: hasPrediction ? undefined : 0.45,
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
                role="tab"
                id="tab-scorer"
                aria-selected={activeTab === 'scorer'}
                aria-controls="panel-scorer"
                aria-describedby={hasPrediction ? undefined : 'view-tabs-hint'}
                disabled={!hasPrediction}
                className={activeTab === 'scorer' ? 'tab-active' : ''}
                style={{
                  padding: '0.5rem 1rem',
                  cursor: hasPrediction ? 'pointer' : 'default',
                  opacity: hasPrediction ? undefined : 0.45,
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
            <span id="view-tabs-hint" className="sr-only">{t('tabsHintDisabled')}</span>
            {hasPrediction ? (
              <div className="animate-fade-in" role="tabpanel" id={activeTab === 'match' ? 'panel-match' : 'panel-scorer'} aria-labelledby={activeTab === 'match' ? 'tab-match' : 'tab-scorer'}>
                {activeTab === 'match' ? (
                  <PredictionPanel
                    prediction={prediction}
                    selectedMarket={selectedMarket}
                    onMarketChange={handleMarketChange}
                    home={selected?.home ?? ''}
                    away={selected?.away ?? ''}
                    fixtures={fixtures}
                    analyst={analyst}
                  />
                ) : scorer ? (
                  <ScorerPanel key={scorer.fixture_id} scorer={scorer} />
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>{t('loadingScorer')}</p>
                )}
              </div>
            ) : (
              <div className="animate-fade-in">
                {!selectedFixture && (
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('selectFixture')}</p>
                )}
                {renderPickOfDay()}
                {stats ? (
                  <StatsDashboard
                    stats={stats}
                    matchdayData={matchdayData}
                    calibrationData={calibrationData}
                    selectedMarket={selectedMarket}
                  />
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>
                    {selectedFixture ? t('loading') : t('selectFixture')}
                  </p>
                )}
              </div>
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

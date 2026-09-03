import { useState, useEffect, useRef } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData, ScorerPrediction } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration, fetchScorer } from './api'
import { useLanguage } from './i18n'
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

  const leagueRequestId = useRef(0)

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

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header
        className="animate-fade-in"
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
          <h1 className="gradient-text" style={{ fontSize: '2rem', letterSpacing: '-0.03em' }}>SciKick</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('tagline')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="league-select" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('league')}
            </label>
            <select
              id="league-select"
              value={league}
              onChange={e => handleLeagueChange(e.target.value)}
              className="select-dark"
            >
              {LEAGUES.map(l => (
                <option key={l.code} value={l.code}>
                  {t(l.labelKey)}
                </option>
              ))}
            </select>
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
        <div className="app-grid">
          <div>
            <h2 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('fixtures')}</h2>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
            ) : fixtures.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>{t('noFixtures')}</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {fixtures.map((f, i) => {
                  const isActive = selectedFixture === f.id
                  const staggerClass = i < 10 ? `stagger-${i + 1}` : ''
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFixtureChange(isActive ? null : f.id)}
                      aria-pressed={isActive}
                      className={`fixture-item animate-fade-in-up ${staggerClass}`}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  )
                })}
              </div>
            )}
          </div>

          <div>
            {selectedFixture && prediction ? (
              <div className="animate-fade-in">
                <div role="tablist" style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
                  <button
                    role="tab"
                    aria-selected={activeTab === 'match'}
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
                    role="tab"
                    aria-selected={activeTab === 'scorer'}
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
                  />
                ) : scorer ? (
                  <ScorerPanel scorer={scorer} />
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>{t('loadingScorer')}</p>
                )}
              </div>
            ) : stats ? (
              <div className="animate-fade-in">
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
        </div>
      )}
    </div>
  )
}

export default App

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

const accent = '#3b82f6'

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

  const tabStyle = (tab: ViewTab) => ({
    padding: '0.5rem 1rem',
    cursor: 'pointer' as const,
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${accent}` : '2px solid transparent',
    background: 'transparent',
    color: activeTab === tab ? accent : '#666',
    fontWeight: activeTab === tab ? 500 : 400,
    fontSize: '0.9rem',
  })

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
        }}
      >
        <div>
          <h1>SciKick</h1>
          <p style={{ color: '#666', margin: 0 }}>{t('tagline')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="league-select" style={{ fontSize: '0.75rem', color: '#666' }}>
              {t('league')}
            </label>
            <select
              id="league-select"
              value={league}
              onChange={e => handleLeagueChange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}
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
        <p
          role="alert"
          style={{ color: '#e74c3c', background: '#fde8e8', padding: '1rem', borderRadius: '8px' }}
        >
          {t(error as 'backendError')}
        </p>
      )}

      {!error && (
        <div className="app-grid">
          <div>
            <h2 style={{ color: '#333', marginBottom: '1rem' }}>{t('fixtures')}</h2>
            {loading ? (
              <p>{t('loading')}</p>
            ) : fixtures.length === 0 ? (
              <p>{t('noFixtures')}</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {fixtures.map(f => {
                  const isActive = selectedFixture === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFixtureChange(isActive ? null : f.id)}
                      aria-pressed={isActive}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem',
                        border: 'none',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        background: isActive ? '#f0f4ff' : 'transparent',
                        borderRadius: '4px',
                        font: 'inherit',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          <span style={{ display: 'block', fontSize: '0.85rem', color: '#666' }}>
                            {f.date} · {f.league}
                          </span>
                          <span style={{ fontWeight: 500 }}>
                            {f.home} vs {f.away}
                            {f.home_score !== null && (
                              <span style={{ marginLeft: '0.5rem', color: '#333' }}>
                                {f.home_score} - {f.away_score}
                              </span>
                            )}
                          </span>
                        </span>
                        {f.prediction != null && (
                          <span style={{ fontSize: '0.75rem', color: accent }}>{t('predicted')}</span>
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
              <div>
                <div role="tablist" style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '1rem' }}>
                  <button role="tab" aria-selected={activeTab === 'match'} style={tabStyle('match')} onClick={() => setActiveTab('match')}>
                    {t('match')}
                  </button>
                  <button role="tab" aria-selected={activeTab === 'scorer'} style={tabStyle('scorer')} onClick={() => setActiveTab('scorer')}>
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
                  <p style={{ color: '#666' }}>{t('loadingScorer')}</p>
                )}
              </div>
            ) : stats ? (
              <StatsDashboard
                stats={stats}
                matchdayData={matchdayData}
                calibrationData={calibrationData}
                selectedMarket={selectedMarket}
              />
            ) : (
              <p style={{ color: '#666' }}>{t('selectFixture')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App

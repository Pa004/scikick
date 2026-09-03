import { useState, useEffect } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData, ScorerPrediction } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration, fetchScorer } from './api'
import PredictionPanel from './components/PredictionPanel'
import ScorerPanel from './components/ScorerPanel'
import StatsDashboard from './components/StatsDashboard'

const LEAGUES = [
  { code: '', label: 'All Leagues' },
  { code: 'E0', label: 'Premier League' },
  { code: 'SP1', label: 'La Liga' },
  { code: 'D1', label: 'Bundesliga' },
  { code: 'I1', label: 'Serie A' },
  { code: 'F1', label: 'Ligue 1' },
]

type ViewTab = 'match' | 'scorer'

function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMarket, setSelectedMarket] = useState('1x2')
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [scorer, setScorer] = useState<ScorerPrediction | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('match')
  const [stats, setStats] = useState<Stats | null>(null)
  const [matchdayData, setMatchdayData] = useState<MatchdayData | null>(null)
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [league, setLeague] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchFixtures(league || undefined)
      .then(data => { setFixtures(data); setLoading(false) })
      .catch(() => { setError('Backend not running. Start with: uvicorn app.api.main:app --reload'); setLoading(false) })

    fetchStats(selectedMarket, league || undefined)
      .then(data => setStats(data))
      .catch(() => {})
  }, [league, selectedMarket])

  useEffect(() => {
    fetchMatchdayStats(selectedMarket, league || undefined)
      .then(data => setMatchdayData(data))
      .catch(() => {})
    fetchCalibration(selectedMarket, league || undefined)
      .then(data => setCalibrationData(data))
      .catch(() => {})
  }, [selectedMarket, league])

  useEffect(() => {
    if (selectedFixture) {
      fetchPrediction(selectedFixture)
        .then(data => setPrediction(data))
        .catch(() => setPrediction(null))
      fetchScorer(selectedFixture)
        .then(data => setScorer(data))
        .catch(() => setScorer(null))
    } else {
      setPrediction(null)
      setScorer(null)
    }
  }, [selectedFixture])

  const tabStyle = (tab: ViewTab) => ({
    padding: '0.5rem 1rem',
    cursor: 'pointer' as const,
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === tab ? '#3b82f6' : '#666',
    fontWeight: activeTab === tab ? 500 : 400,
    fontSize: '0.9rem',
  })

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#1a1a2e', margin: 0 }}>SciKick</h1>
          <p style={{ color: '#666', margin: 0 }}>Football Probability Estimation Engine</p>
        </div>
        <select
          value={league}
          onChange={e => { setLeague(e.target.value); setSelectedFixture(null) }}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}
        >
          {LEAGUES.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </header>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#e74c3c', background: '#fde8e8', padding: '1rem', borderRadius: '8px' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h2 style={{ color: '#333', marginBottom: '1rem' }}>Fixtures</h2>
            {fixtures.length === 0 ? (
              <p>No fixtures found. Run sync first.</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {fixtures.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFixture(f.id === selectedFixture ? null : f.id)}
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      background: selectedFixture === f.id ? '#f0f4ff' : 'transparent',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{f.date} · {f.league}</div>
                        <div style={{ fontWeight: 500 }}>
                          {f.home} vs {f.away}
                          {f.home_score !== null && (
                            <span style={{ marginLeft: '0.5rem', color: '#333' }}>
                              {f.home_score} - {f.away_score}
                            </span>
                          )}
                        </div>
                      </div>
                      {f.prediction && (
                        <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>predicted</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {selectedFixture && prediction ? (
              <div>
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '1rem' }}>
                  <button style={tabStyle('match')} onClick={() => setActiveTab('match')}>Match</button>
                  <button style={tabStyle('scorer')} onClick={() => setActiveTab('scorer')}>Goalscorer</button>
                </div>
                {activeTab === 'match' ? (
                  <PredictionPanel
                    prediction={prediction}
                    selectedMarket={selectedMarket}
                    onMarketChange={setSelectedMarket}
                  />
                ) : scorer ? (
                  <ScorerPanel scorer={scorer} />
                ) : (
                  <p style={{ color: '#999' }}>Loading scorer data...</p>
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
              <p style={{ color: '#999' }}>Select a fixture to see predictions.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App

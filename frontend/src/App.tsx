import { useState, useEffect } from 'react'
import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData } from './types'
import { fetchFixtures, fetchPrediction, fetchStats, fetchMatchdayStats, fetchCalibration } from './api'
import PredictionPanel from './components/PredictionPanel'
import StatsDashboard from './components/StatsDashboard'

const LEAGUES = [
  { code: '', label: 'All Leagues' },
  { code: 'E0', label: 'Premier League' },
  { code: 'SP1', label: 'La Liga' },
  { code: 'D1', label: 'Bundesliga' },
  { code: 'I1', label: 'Serie A' },
  { code: 'F1', label: 'Ligue 1' },
]

function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMarket, setSelectedMarket] = useState('1x2')
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
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
    } else {
      setPrediction(null)
    }
  }, [selectedFixture])

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
              <PredictionPanel
                prediction={prediction}
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
              />
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

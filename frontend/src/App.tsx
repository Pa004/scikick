import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface Fixture {
  id: number
  date: string
  home: string
  away: string
  status: string
  home_score: number | null
  away_score: number | null
  prediction: Record<string, unknown> | null
}

interface Prediction {
  fixture_id: number
  model_version: string
  model_agreement: number
  probabilities: Record<string, unknown>
}

interface Stats {
  total_predictions: number
  accuracy: number
  avg_confidence: number
  by_confidence_band: Array<{ band: string; total: number; hits: number; accuracy: number }>
  cold_start: boolean
}

const API_BASE = 'http://localhost:8000/api'
const MARKETS = [
  '1x2', 'double_chance', 'over_under_2.5', 'btts', 'draw_no_bet',
  'clean_sheet', 'win_to_nil', 'goal_bands', 'odd_even',
]

function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMarket, setSelectedMarket] = useState('1x2')
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/fixtures?limit=30`)
      .then(res => {
        if (!res.ok) throw new Error('API not available')
        return res.json()
      })
      .then(data => {
        setFixtures(data.fixtures || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Backend not running. Start with: uvicorn app.api.main:app --reload')
        setLoading(false)
      })

    fetch(`${API_BASE}/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedFixture) {
      fetch(`${API_BASE}/predict/${selectedFixture}`)
        .then(res => {
          if (!res.ok) throw new Error('No prediction')
          return res.json()
        })
        .then(data => setPrediction(data))
        .catch(() => setPrediction(null))
    }
  }, [selectedFixture])

  const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

  const renderMarketProbs = (market: string) => {
    if (!prediction?.probabilities) return null
    const probs = prediction.probabilities[market]
    if (!probs) return <span style={{ color: '#999' }}>N/A</span>

    if (market === '1x2' || market === 'draw_no_bet') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          {probs.home !== undefined && <span>Home: {formatProb(probs.home)}</span>}
          {probs.draw !== undefined && <span>Draw: {formatProb(probs.draw)}</span>}
          {probs.away !== undefined && <span>Away: {formatProb(probs.away)}</span>}
        </div>
      )
    }

    if (market === 'double_chance') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>H/D: {formatProb(probs.home_or_draw)}</span>
          <span>D/A: {formatProb(probs.draw_or_away)}</span>
          <span>H/A: {formatProb(probs.home_or_away)}</span>
        </div>
      )
    }

    if (market === 'over_under_2.5') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Over: {formatProb(probs.over)}</span>
          <span>Under: {formatProb(probs.under)}</span>
        </div>
      )
    }

    if (market === 'btts') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Yes: {formatProb(probs.yes)}</span>
          <span>No: {formatProb(probs.no)}</span>
        </div>
      )
    }

    if (market === 'clean_sheet') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Home Yes: {formatProb(probs.home_yes)}</span>
          <span>Away Yes: {formatProb(probs.away_yes)}</span>
        </div>
      )
    }

    if (market === 'win_to_nil') {
      return (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Home: {formatProb(probs.home)}</span>
          <span>Away: {formatProb(probs.away)}</span>
        </div>
      )
    }

    return <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(probs, null, 2)}</pre>
  }

  const calibrationData = stats?.by_confidence_band?.map(b => ({
    band: b.band,
    accuracy: b.accuracy * 100,
    count: b.total,
  })) || []

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#1a1a2e', marginBottom: '0.5rem' }}>SciKick</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Football Probability Estimation Engine</p>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#e74c3c', background: '#fde8e8', padding: '1rem', borderRadius: '8px' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#333', margin: 0 }}>Fixtures</h2>
              <select
                value={selectedMarket}
                onChange={e => setSelectedMarket(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {fixtures.length === 0 ? (
              <p>No fixtures found. Run sync first.</p>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {fixtures.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFixture(f.id)}
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      background: selectedFixture === f.id ? '#f0f4ff' : 'transparent',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{f.date}</div>
                    <div style={{ fontWeight: 500 }}>
                      {f.home} vs {f.away}
                      {f.home_score !== null && (
                        <span style={{ marginLeft: '0.5rem', color: '#333' }}>
                          {f.home_score} - {f.away_score}
                        </span>
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
                <h2 style={{ color: '#333', marginBottom: '1rem' }}>Prediction</h2>
                <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    Model: {prediction.model_version} | Agreement: {formatProb(prediction.model_agreement)}
                  </div>
                </div>
                <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{selectedMarket}</h3>
                  {renderMarketProbs(selectedMarket)}
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ color: '#333', marginBottom: '1rem' }}>Stats</h2>
                {stats && !stats.cold_start ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{stats.total_predictions}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Predictions</div>
                      </div>
                      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{formatProb(stats.accuracy)}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Accuracy</div>
                      </div>
                      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{formatProb(stats.avg_confidence)}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Avg Confidence</div>
                      </div>
                    </div>

                    <h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Calibration by Confidence Band</h3>
                    <div style={{ height: '200px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={calibrationData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="band" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#999' }}>No stats yet. Train models first.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App

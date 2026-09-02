import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Fixture {
  id: number
  date: string
  home: string
  away: string
  prediction: string | null
}

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/fixtures?limit=20`)
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
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#1a1a2e', marginBottom: '0.5rem' }}>SciKick</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Football Probability Estimation Engine</p>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#e74c3c', background: '#fde8e8', padding: '1rem', borderRadius: '8px' }}>{error}</p>}

      {!loading && !error && (
        <div>
          <h2 style={{ color: '#333', marginBottom: '1rem' }}>Recent Fixtures</h2>
          {fixtures.length === 0 ? (
            <p>No fixtures found. Run sync first.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Home</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Away</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Prediction</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.75rem' }}>{f.date}</td>
                    <td style={{ padding: '0.75rem' }}>{f.home}</td>
                    <td style={{ padding: '0.75rem' }}>{f.away}</td>
                    <td style={{ padding: '0.75rem' }}>{f.prediction || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 style={{ color: '#333', marginTop: '2rem', marginBottom: '1rem' }}>Calibration Chart</h2>
          <div style={{ height: '300px', background: '#f9f9f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#999' }}>Calibration chart will appear after training</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

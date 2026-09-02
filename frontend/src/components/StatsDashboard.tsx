import type { Stats, MatchdayData, CalibrationData } from '../types'
import CalibrationChart from './CalibrationChart'
import MatchdayChart from './MatchdayChart'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

interface StatsDashboardProps {
  stats: Stats
  matchdayData: MatchdayData | null
  calibrationData: CalibrationData | null
  selectedMarket: string
}

export default function StatsDashboard({ stats, matchdayData, calibrationData, selectedMarket }: StatsDashboardProps) {
  if (stats.cold_start) {
    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '1rem' }}>Stats</h2>
        <p style={{ color: '#999' }}>No stats yet. Train models first.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ color: '#333', marginBottom: '1rem' }}>Stats</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard value={String(stats.total_predictions)} label="Predictions" />
        <StatCard value={formatProb(stats.accuracy)} label="Accuracy" />
        <StatCard value={formatProb(stats.avg_confidence)} label="Avg Confidence" />
      </div>

      <Section title={`Brier Score by Matchday — ${selectedMarket}`}>
        {matchdayData && !matchdayData.cold_start ? (
          <MatchdayChart data={matchdayData.data} />
        ) : (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>Need at least 5 matchdays of data.</p>
        )}
      </Section>

      <Section title={`Calibration Curve — ${selectedMarket}`}>
        {calibrationData && !calibrationData.cold_start ? (
          <CalibrationChart data={calibrationData.data} />
        ) : (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>Need at least 30 resolved predictions.</p>
        )}
      </Section>

      {stats.by_market.length > 0 && (
        <Section title="By Market">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Market</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_market.map(m => (
                <tr key={m.market} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {m.market}
                    {m.cold_start && <span style={{ color: '#f39c12', marginLeft: '0.5rem', fontSize: '0.75rem' }}>cold</span>}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.total}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatProb(m.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {stats.by_league.length > 1 && (
        <Section title="By League">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>League</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_league.map(l => (
                <tr key={l.league} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem' }}>{l.league}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{l.total}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatProb(l.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#666' }}>{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: '#333', marginBottom: '0.5rem', fontSize: '1rem' }}>{title}</h3>
      {children}
    </div>
  )
}

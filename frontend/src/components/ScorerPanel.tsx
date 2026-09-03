import type { ScorerPrediction } from '../types'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

interface ScorerPanelProps {
  scorer: ScorerPrediction
}

export default function ScorerPanel({ scorer }: ScorerPanelProps) {
  return (
    <div>
      <h2 style={{ color: '#333', marginBottom: '1rem' }}>Goalscorer</h2>

      <div style={{
        background: scorer.data_quality === 'lineup_confirmed' ? '#f0fdf4' : '#fefce8',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}>
        {scorer.data_quality === 'lineup_confirmed'
          ? 'Lineup confirmed'
          : 'Lineup unavailable — projected from historical starters'}
      </div>

      {scorer.scorers.length === 0 ? (
        <p style={{ color: '#999' }}>No scorer data available for this fixture.</p>
      ) : (
        <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>Player</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>Team</th>
                <th style={{ textAlign: 'center', padding: '0.5rem', color: '#666' }}>xG90</th>
                <th style={{ textAlign: 'center', padding: '0.5rem', color: '#666' }}>Min</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', color: '#666' }}>Prob</th>
              </tr>
            </thead>
            <tbody>
              {scorer.scorers.map(s => (
                <tr
                  key={s.player_id}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    background: s.home_away === 'home' ? 'transparent' : '#fafafa',
                  }}
                >
                  <td style={{ padding: '0.5rem', fontWeight: 500 }}>
                    {s.name}
                    <span style={{ color: '#999', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                      {s.position}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', color: '#666' }}>{s.team}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.xg90.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.min_expected.toFixed(0)}'</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                    <span style={{
                      background: s.prob_anytime > 0.3 ? '#dcfce7' : s.prob_anytime > 0.15 ? '#fef9c3' : '#f3f4f6',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                    }}>
                      {formatProb(s.prob_anytime)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

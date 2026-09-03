import type { ScorerPrediction } from '../types'
import { useLanguage } from '../i18n'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

interface ScorerPanelProps {
  scorer: ScorerPrediction
}

export default function ScorerPanel({ scorer }: ScorerPanelProps) {
  const { t } = useLanguage()
  return (
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('goalscorer')}</h2>

      <div
        className={scorer.data_quality === 'lineup_confirmed' ? 'badge badge-success' : 'badge badge-warning'}
        style={{ display: 'inline-block', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
      >
        {scorer.data_quality === 'lineup_confirmed'
          ? t('lineupConfirmed')
          : t('lineupUnavailable')}
      </div>

      {scorer.scorers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('noScorerData')}</p>
      ) : (
        <div className="card-flat" style={{ overflowX: 'auto', padding: '0.5rem' }}>
          <table className="table-dark">
            <thead>
              <tr>
                <th>{t('player')}</th>
                <th>{t('team')}</th>
                <th style={{ textAlign: 'center' }}>{t('xg90')}</th>
                <th style={{ textAlign: 'center' }}>{t('min')}</th>
                <th style={{ textAlign: 'right' }}>{t('prob')}</th>
              </tr>
            </thead>
            <tbody>
              {scorer.scorers.map(s => (
                <tr key={s.player_id}>
                  <td style={{ fontWeight: 500 }}>
                    {s.name}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                      {s.position}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.team}</td>
                  <td style={{ textAlign: 'center' }}>{s.xg90.toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>{s.min_expected.toFixed(0)}'</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    <span className={
                      s.prob_anytime > 0.3 ? 'badge badge-success' :
                      s.prob_anytime > 0.15 ? 'badge badge-warning' :
                      'badge'
                    } style={s.prob_anytime <= 0.15 ? { background: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-secondary)' } : undefined}>
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

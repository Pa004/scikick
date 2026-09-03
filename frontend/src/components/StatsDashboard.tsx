import type { Stats, MatchdayData, CalibrationData } from '../types'
import { useLanguage } from '../i18n'
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
  const { t } = useLanguage()

  if (stats.cold_start) {
    return (
      <div>
        <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('stats')}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{t('noStats')}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('stats')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard value={String(stats.total_predictions)} label={t('predictions')} />
        <StatCard value={formatProb(stats.accuracy)} label={t('accuracy')} />
        <StatCard value={formatProb(stats.avg_confidence)} label={t('avgConfidence')} />
      </div>

      <Section title={`Brier Score by Matchday — ${selectedMarket}`}>
        {matchdayData && !matchdayData.cold_start ? (
          <MatchdayChart data={matchdayData.data} />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noMatchday')}</p>
        )}
      </Section>

      <Section title={`Calibration Curve — ${selectedMarket}`}>
        {calibrationData && !calibrationData.cold_start ? (
          <CalibrationChart data={calibrationData.data} />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noCalibration')}</p>
        )}
      </Section>

      {stats.by_market.length > 0 && (
        <Section title={t('byMarket')}>
          <div className="card-flat" style={{ overflowX: 'auto', padding: '0.5rem' }}>
            <table className="table-dark">
              <thead>
                <tr>
                  <th>{t('market')}</th>
                  <th style={{ textAlign: 'right' }}>{t('total')}</th>
                  <th style={{ textAlign: 'right' }}>{t('accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_market.map(m => (
                  <tr key={m.market}>
                    <td>
                      {m.market}
                      {m.cold_start && <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{t('cold')}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{m.total}</td>
                    <td style={{ textAlign: 'right' }}>{formatProb(m.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {stats.by_league.length > 1 && (
        <Section title={t('byLeague')}>
          <div className="card-flat" style={{ overflowX: 'auto', padding: '0.5rem' }}>
            <table className="table-dark">
              <thead>
                <tr>
                  <th>{t('league')}</th>
                  <th style={{ textAlign: 'right' }}>{t('total')}</th>
                  <th style={{ textAlign: 'right' }}>{t('accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_league.map(l => (
                  <tr key={l.league}>
                    <td>{l.league}</td>
                    <td style={{ textAlign: 'right' }}>{l.total}</td>
                    <td style={{ textAlign: 'right' }}>{formatProb(l.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>{title}</h3>
      {children}
    </div>
  )
}

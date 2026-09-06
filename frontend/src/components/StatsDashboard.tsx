import type { Stats, MatchdayData, CalibrationData } from '../types'
import { useLanguage } from '../i18n'
import { useCountUp } from '../hooks/useCountUp'
import CalibrationChart from './CalibrationChart'
import MatchdayChart from './MatchdayChart'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

// Thresholds calibrated to the backend's approximate matchday Brier
// (range 0-2), not the classic 0-1 probabilistic Brier.
const BRIER_EXCELLENT_MAX = 0.1
const BRIER_REASONABLE_MAX = 0.3
const CALIBRATION_TOLERANCE = 0.1

function fill(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v))
  return out
}

function meanBrier(matchdayData: MatchdayData | null): number | null {
  if (!matchdayData || matchdayData.cold_start || matchdayData.data.length === 0) return null
  const sum = matchdayData.data.reduce((acc, d) => acc + d.brier, 0)
  return sum / matchdayData.data.length
}

function calibrationSummary(calibrationData: CalibrationData | null): { good: number; total: number; n: number } | null {
  if (!calibrationData || calibrationData.cold_start || calibrationData.data.length === 0) return null
  const bins = calibrationData.data.filter(b => b.count > 0)
  const good = bins.filter(b => Math.abs(b.avg_predicted - b.actual_accuracy) <= CALIBRATION_TOLERANCE).length
  return { good, total: bins.length, n: bins.reduce((acc, b) => acc + b.count, 0) }
}

function TrustBlock({ stats, matchdayData, calibrationData }: StatsDashboardProps) {
  const { t } = useLanguage()
  const brier = meanBrier(matchdayData)
  const cal = calibrationSummary(calibrationData)
  const reading = brier === null ? null : brier <= BRIER_EXCELLENT_MAX
    ? { key: 'trustBrierExcellent' as const, badge: 'badge-success' }
    : brier <= BRIER_REASONABLE_MAX
      ? { key: 'trustBrierReasonable' as const, badge: 'badge-warning' }
      : { key: 'trustBrierWeak' as const, badge: 'badge-danger' }

  return (
    <div className="trust-block">
      <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>
        {t('trustTitle')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem' }}>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Brier: </span>
          {reading ? (
            <>
              <span style={{ fontWeight: 600 }}>{brier?.toFixed(3)}</span>
              {' '}
              <span className={`badge ${reading.badge}`}>{t(reading.key)}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{t('trustBrierNoData')}</span>
          )}
        </div>
        <div>
          {cal ? (
            <span>{fill(t('trustCalibration'), { good: cal.good, total: cal.total })}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{t('trustCalibrationPending')}</span>
          )}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {fill(t('trustSample'), { n: stats.total_predictions, m: cal?.n ?? 0 })}
        </div>
      </div>
    </div>
  )
}

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
        <StatCard value={stats.total_predictions} label={t('predictions')} format={v => String(Math.round(v))} />
        <StatCard value={stats.accuracy} label={t('accuracy')} format={v => formatProb(v)} />
        <StatCard value={stats.avg_confidence} label={t('avgConfidence')} format={v => formatProb(v)} />
      </div>

      <TrustBlock stats={stats} matchdayData={matchdayData} calibrationData={calibrationData} selectedMarket={selectedMarket} />

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
          <div className="card-flat" tabIndex={0} role="region" aria-label={t('byMarket')} style={{ overflowX: 'auto', padding: '0.5rem' }}>
            <table className="table-dark">
              <thead>
                <tr>
                  <th scope="col">{t('market')}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>{t('total')}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>{t('accuracy')}</th>
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
          <div className="card-flat" tabIndex={0} role="region" aria-label={t('byLeague')} style={{ overflowX: 'auto', padding: '0.5rem' }}>
            <table className="table-dark">
              <thead>
                <tr>
                  <th scope="col">{t('league')}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>{t('total')}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>{t('accuracy')}</th>
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

function StatCard({ value, label, format }: { value: number; label: string; format: (v: number) => string }) {
  const animated = useCountUp(value)
  return (
    <div className="stat-card">
      <div className="stat-card-value">{format(animated)}</div>
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

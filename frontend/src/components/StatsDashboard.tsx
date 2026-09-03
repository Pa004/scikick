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
        <h2 style={{ color: '#333', marginBottom: '1rem' }}>{t('stats')}</h2>
        <p style={{ color: '#999' }}>{t('noStats')}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ color: '#333', marginBottom: '1rem' }}>{t('stats')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard value={String(stats.total_predictions)} label={t('predictions')} />
        <StatCard value={formatProb(stats.accuracy)} label={t('accuracy')} />
        <StatCard value={formatProb(stats.avg_confidence)} label={t('avgConfidence')} />
      </div>

      <Section title={`Brier Score by Matchday — ${selectedMarket}`}>
        {matchdayData && !matchdayData.cold_start ? (
          <MatchdayChart data={matchdayData.data} />
        ) : (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>{t('noMatchday')}</p>
        )}
      </Section>

      <Section title={`Calibration Curve — ${selectedMarket}`}>
        {calibrationData && !calibrationData.cold_start ? (
          <CalibrationChart data={calibrationData.data} />
        ) : (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>{t('noCalibration')}</p>
        )}
      </Section>

      {stats.by_market.length > 0 && (
        <Section title={t('byMarket')}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>{t('market')}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('total')}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_market.map(m => (
                  <tr key={m.market} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.5rem' }}>
                      {m.market}
                      {m.cold_start && <span style={{ color: '#f39c12', marginLeft: '0.5rem', fontSize: '0.75rem' }}>{t('cold')}</span>}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.total}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatProb(m.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {stats.by_league.length > 1 && (
        <Section title={t('byLeague')}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>{t('league')}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('total')}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('accuracy')}</th>
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
          </div>
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

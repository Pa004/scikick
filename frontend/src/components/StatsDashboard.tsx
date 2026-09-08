import type { Stats, MatchdayData, CalibrationData } from '../types'
import { useLanguage, fillVars as fill } from '../i18n'
import { useCountUp } from '../hooks/useCountUp'
import { Badge } from './ui/badge'
import { Card, CardBody, CardTitle } from './ui/card'
import { Table, TableRegion, Td, Th } from './ui/table'
import CalibrationChart from './CalibrationChart'
import MatchdayChart from './MatchdayChart'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

// Thresholds calibrated to the backend's approximate matchday Brier
// (range 0-2), not the classic 0-1 probabilistic Brier.
const BRIER_EXCELLENT_MAX = 0.1
const BRIER_REASONABLE_MAX = 0.3
const CALIBRATION_TOLERANCE = 0.1

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

function TrustBlock({ stats, matchdayData, calibrationData }: Omit<StatsDashboardProps, 'selectedMarket'>) {
  const { t } = useLanguage()
  const brier = meanBrier(matchdayData)
  const cal = calibrationSummary(calibrationData)
  const reading = brier === null ? null : brier <= BRIER_EXCELLENT_MAX
    ? { key: 'trustBrierExcellent' as const, variant: 'success' as const }
    : brier <= BRIER_REASONABLE_MAX
      ? { key: 'trustBrierReasonable' as const, variant: 'warning' as const }
      : { key: 'trustBrierWeak' as const, variant: 'danger' as const }

  return (
    <Card className="mb-6 border-l-4 border-l-primary">
      <CardBody>
        <CardTitle className="mb-3">{t('trustTitle')}</CardTitle>
        <div className="flex flex-col gap-1.5 text-sm">
          <div>
            <span className="text-muted">Brier: </span>
            {reading ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{brier?.toFixed(3)}</span>{' '}
                <Badge variant={reading.variant}>{t(reading.key)}</Badge>
              </>
            ) : (
              <span className="text-faint">{t('trustBrierNoData')}</span>
            )}
          </div>
          <div className="text-foreground">
            {cal ? (
              <span>{fill(t('trustCalibration'), { good: cal.good, total: cal.total })}</span>
            ) : (
              <span className="text-faint">{t('trustCalibrationPending')}</span>
            )}
          </div>
          <div className="text-xs text-faint">
            {fill(t('trustSample'), { n: stats.total_predictions, m: cal?.n ?? 0 })}
          </div>
        </div>
      </CardBody>
    </Card>
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
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t('stats')}</h2>
        <p className="text-sm text-faint">{t('noStats')}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t('stats')}</h2>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard value={stats.total_predictions} label={t('predictions')} format={v => String(Math.round(v))} />
        <StatCard value={stats.accuracy} label={t('accuracy')} format={v => formatProb(v)} />
        <StatCard value={stats.avg_confidence} label={t('avgConfidence')} format={v => formatProb(v)} />
      </div>

      <TrustBlock stats={stats} matchdayData={matchdayData} calibrationData={calibrationData} />

      <Section title={`Brier Score by Matchday — ${selectedMarket}`}>
        {matchdayData && !matchdayData.cold_start ? (
          <MatchdayChart data={matchdayData.data} />
        ) : (
          <p className="text-sm text-faint">{t('noMatchday')}</p>
        )}
      </Section>

      <Section title={`Calibration Curve — ${selectedMarket}`}>
        {calibrationData && !calibrationData.cold_start ? (
          <CalibrationChart data={calibrationData.data} />
        ) : (
          <p className="text-sm text-faint">{t('noCalibration')}</p>
        )}
      </Section>

      {stats.by_market.length > 0 && (
        <Section title={t('byMarket')}>
          <Card>
            <TableRegion role="region" aria-label={t('byMarket')} tabIndex={0} className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('market')}</Th>
                    <Th align="right">{t('total')}</Th>
                    <Th align="right">{t('accuracy')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_market.map(m => (
                    <tr key={m.market} className="transition-colors hover:bg-surface-hover">
                      <Td>
                        {m.market}
                        {m.cold_start && <Badge variant="warning" className="ml-2 text-[0.65rem]">{t('cold')}</Badge>}
                      </Td>
                      <Td align="right">{m.total}</Td>
                      <Td align="right">{formatProb(m.accuracy)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableRegion>
          </Card>
        </Section>
      )}

      {stats.by_league.length > 1 && (
        <Section title={t('byLeague')}>
          <Card>
            <TableRegion role="region" aria-label={t('byLeague')} tabIndex={0} className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('league')}</Th>
                    <Th align="right">{t('total')}</Th>
                    <Th align="right">{t('accuracy')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_league.map(l => (
                    <tr key={l.league} className="transition-colors hover:bg-surface-hover">
                      <Td>{l.league}</Td>
                      <Td align="right">{l.total}</Td>
                      <Td align="right">{formatProb(l.accuracy)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableRegion>
          </Card>
        </Section>
      )}
    </div>
  )
}

function StatCard({ value, label, format }: { value: number; label: string; format: (v: number) => string }) {
  const safe = Number.isFinite(value) ? value : null
  const animated = useCountUp(safe ?? 0)
  return (
    <div className="animate-pop rounded-xl border border-border bg-surface px-2 py-4 text-center shadow-sm">
      <div className="font-display text-xl font-bold text-primary-strong tabular-nums sm:text-2xl">{safe === null ? '—' : format(animated)}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{title}</h3>
      {children}
    </div>
  )
}

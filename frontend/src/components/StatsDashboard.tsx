import { useState } from 'react'
import type { Stats, MatchdayData, CalibrationData } from '../types'
import { useLanguage, fillVars as fill } from '../i18n'
import { useCountUp } from '../hooks/useCountUp'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { getMarketLabel } from '../utils/marketLabels'
import { LEAGUES } from './layout/LeagueSwitcher'
import { Badge } from './ui/badge'
import { Card, CardBody, CardTitle } from './ui/card'
import { Input } from './ui/input'
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
      ? { key: 'trustBrierReasonable' as const, variant: 'neutral' as const }
      : { key: 'trustBrierWeak' as const, variant: 'danger' as const }

  return (
    <Card className="mb-6 border-l-4 border-l-primary">
      <CardBody>
        <CardTitle className="mb-3">{t('trustTitle')}</CardTitle>
        <div className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted">Brier: </span>
            {reading ? (
              <>
                <span className="font-mono font-semibold text-foreground tabular-nums">{brier?.toFixed(3)}</span>{' '}
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
            {cal !== null && cal.n !== stats.total_predictions
              ? fill(t('trustSample'), { n: stats.total_predictions, m: cal.n })
              : fill(t('trustSampleFull'), { n: stats.total_predictions })}
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
  // League scope these numbers were computed for (chip under the title).
  scopeName?: string
}

export default function StatsDashboard({ stats, matchdayData, calibrationData, selectedMarket, scopeName }: StatsDashboardProps) {
  const { t, locale } = useLanguage()
  const [marketQuery, setMarketQuery] = useState('')
  const [accuracyDir, setAccuracyDir] = useState<'asc' | 'desc'>('desc')

  if (stats.cold_start) {
    return (
      <div>
        <h2 className="mb-4 text-[26px] leading-tight font-bold text-foreground">{t('stats')}</h2>
        <div className="rounded-[14px] border border-dashed border-border-strong bg-surface p-7">
          <p className="text-[15px] text-muted">{t('noStats')}</p>
        </div>
      </div>
    )
  }

  const mdData = matchdayData !== null && !matchdayData.cold_start && matchdayData.data.length > 0
    ? matchdayData.data
    : null
  const calData = calibrationData !== null && !calibrationData.cold_start && calibrationData.data.length > 0
    ? calibrationData.data
    : null
  const q = marketQuery.trim().toLowerCase()
  const markets = stats.by_market
    .filter(m => {
      if (!q) return true
      return getMarketLabel(m.market, locale).toLowerCase().includes(q) || m.market.toLowerCase().includes(q)
    })
    .sort((a, b) => (accuracyDir === 'desc' ? b.accuracy - a.accuracy : a.accuracy - b.accuracy))
  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">{t('stats')}</h2>
      {scopeName && (
        <p className="mt-1 mb-4">
          <Badge variant="neutral" className="text-xs">{scopeName}</Badge>
        </p>
      )}
      {!scopeName && <div className="mb-4" />}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard value={stats.total_predictions} label={t('predictions')} format={v => String(Math.round(v))} />
        <StatCard value={stats.accuracy} label={t('accuracy')} format={v => formatProb(v)} />
        <StatCard value={stats.avg_confidence} label={t('avgConfidence')} format={v => formatProb(v)} />
      </div>

      <TrustBlock stats={stats} matchdayData={matchdayData} calibrationData={calibrationData} />

      {mdData !== null ? (
        <Section title={`${t('brierByMatchday')} — ${selectedMarket}`}>
          <MatchdayChart data={mdData} />
        </Section>
      ) : (
        <p className="mb-6 text-sm text-faint">{t('noMatchday')}</p>
      )}

      {calData !== null ? (
        <Section title={`${t('calibrationCurve')} — ${selectedMarket}`}>
          <CalibrationChart data={calData} />
        </Section>
      ) : (
        <p className="mb-6 text-sm text-faint">{t('noCalibration')}</p>
      )}

      {stats.by_market.length > 0 && (
        <Section title={`${t('byMarket')} · ${markets.length}`}>
          <Input
            type="search"
            value={marketQuery}
            onChange={e => setMarketQuery(e.target.value)}
            placeholder={t('marketSearch')}
            aria-label={t('marketSearch')}
            className="mb-3"
          />
          {markets.length === 0 ? (
            <p className="m-0 text-sm text-faint">{t('noMarketMatch')}</p>
          ) : (
            <Card>
              <TableRegion role="region" aria-label={t('byMarket')} tabIndex={0} className="border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('market')}</Th>
                      <Th align="right">{t('total')}</Th>
                      <Th align="right" aria-sort={accuracyDir === 'asc' ? 'ascending' : 'descending'}>
                        <button
                          type="button"
                          onClick={() => setAccuracyDir(accuracyDir === 'asc' ? 'desc' : 'asc')}
                          aria-label={`${t('sortBy')} ${t('accuracy')}, ${accuracyDir === 'asc' ? t('sortAsc') : t('sortDesc')}`}
                          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 bg-transparent p-1 font-medium text-inherit hover:text-foreground"
                        >
                          {t('accuracy')}
                          {accuracyDir === 'asc'
                            ? <ArrowUp aria-hidden="true" className="size-4 text-primary-strong" />
                            : <ArrowDown aria-hidden="true" className="size-4 text-primary-strong" />}
                        </button>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map(m => (
                      <tr key={m.market} className="transition-colors hover:bg-surface-hover">
                        <Td title={m.market}>
                          {getMarketLabel(m.market, locale)}
                          {m.cold_start && <Badge variant="neutral" className="ml-2 text-xs">{t('cold')}</Badge>}
                        </Td>
                        <Td align="right">{m.total}</Td>
                        <Td align="right">{formatProb(m.accuracy)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableRegion>
            </Card>
          )}
        </Section>
      )}

      {stats.by_league.length > 1 && (
        <Section title={`${t('byLeague')} · ${stats.by_league.length}`}>
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
                      <Td>{leagueName(l.league)}</Td>
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
    <div className="animate-pop rounded-[14px] border border-border bg-surface px-2 py-4 text-center">
      <div className="font-mono text-[22px] font-bold text-primary-strong tabular-nums">{safe === null ? '—' : format(animated)}</div>
      <div className="mt-1 text-[13px] text-balance text-muted">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-extrabold tracking-[0.08em] text-faint uppercase">{title}</h3>
      {children}
    </div>
  )
}

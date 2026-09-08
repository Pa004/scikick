import type { Fixture, Prediction, TeamContext, ValueResponse } from '../types'
import { useEffect, useState } from 'react'
import { fetchContext } from '../api'
import { useLanguage } from '../i18n'
import { useDisplayMode, type DisplayMode } from '../hooks/useDisplayMode'
import { useMovement } from '../hooks/useMovement'
import { formatDecimal } from '../utils/odds'
import { getMarketLabel, getOutcomeLabel } from '../utils/marketLabels'
import {
  getTeamForm,
  getHeadToHead,
  getMomentum,
  getSuperCombo,
  type FormOutcome,
} from '../utils/matchCenter'
import MarketRenderer from './MarketRenderer'
import MarketSelector from './MarketSelector'
import DisplayModeToggle from './DisplayModeToggle'
import ValueChecker from './ValueChecker'
import { Badge } from './ui/badge'
import { Card, CardBody, CardTitle, SectionHeading } from './ui/card'
import { Table, Td, Th } from './ui/table'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

// Internal model names leak as snake_case; present them as titles.
function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function FormBadges({ form, emptyLabel }: { form: FormOutcome[]; emptyLabel: string }) {
  const { t } = useLanguage()
  const word = (o: FormOutcome) => (o === 'W' ? t('formWin') : o === 'D' ? t('formDraw') : t('formLoss'))
  if (form.length === 0) {
    return <span className="text-xs text-faint">{emptyLabel}</span>
  }
  return (
    <span className="inline-flex gap-1" role="list" aria-label={t('formLegend')}>
      {form.map((o, i) => (
        <Badge
          key={i}
          role="listitem"
          aria-label={word(o)}
          title={word(o)}
          variant={o === 'W' ? 'success' : o === 'D' ? 'warning' : 'danger'}
          className="min-w-7 justify-center font-mono"
        >
          {o}
        </Badge>
      ))}
    </span>
  )
}

function MomentumRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="relative flex min-h-10 items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
      <div className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      <span className="relative z-10 font-medium text-foreground">{label}</span>
      <span className="relative z-10 text-muted tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  )
}

function MatchCenter({ home, away, fixtures }: { home: string; away: string; fixtures: Fixture[] }) {
  const { t } = useLanguage()
  const [serverHome, setServerHome] = useState<TeamContext | null>(null)
  const [serverAway, setServerAway] = useState<TeamContext | null>(null)

  useEffect(() => {
    let active = true
    setServerHome(null)
    setServerAway(null)
    Promise.all([
      fetchContext(home, away).catch(() => null),
      fetchContext(away, home).catch(() => null),
    ]).then(([h, a]) => {
      if (!active) return
      setServerHome(h)
      setServerAway(a)
    })
    return () => {
      active = false
    }
  }, [home, away])

  const homeForm = serverHome && serverHome.form.length > 0
    ? serverHome.form.map(f => f.result)
    : getTeamForm(fixtures, home)
  const awayForm = serverAway && serverAway.form.length > 0
    ? serverAway.form.map(f => f.result)
    : getTeamForm(fixtures, away)
  const serverH2H = serverHome?.h2h
  const h2h = serverH2H && (serverH2H.wins + serverH2H.draws + serverH2H.losses) > 0
    ? {
        homeWins: serverH2H.wins,
        draws: serverH2H.draws,
        awayWins: serverH2H.losses,
        meetings: serverH2H.matches.slice(0, 5).map(m => {
          const [hs, aws] = m.score.split('-').map(Number)
          return { date: m.date, home: m.home, away: m.away, homeScore: hs, awayScore: aws }
        }),
      }
    : getHeadToHead(home, away, fixtures)
  const momentum = getMomentum(homeForm, awayForm)

  return (
    <Card className="mb-4">
      <CardBody>
        <CardTitle className="mb-3">{t('matchCenter')}</CardTitle>
        <SectionHeading>{t('form')} · {t('last5')}</SectionHeading>
        <div className="mb-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{home}</span>
            <FormBadges form={homeForm} emptyLabel={t('noFormData')} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{away}</span>
            <FormBadges form={awayForm} emptyLabel={t('noFormData')} />
          </div>
        </div>
        <SectionHeading>{t('headToHead')}</SectionHeading>
        {h2h.meetings.length === 0 ? (
          <p className="mb-3 text-xs text-faint">{t('noH2H')}</p>
        ) : (
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-foreground tabular-nums">
              {home} {h2h.homeWins} - {h2h.draws} - {h2h.awayWins} {away}
            </div>
            {h2h.meetings.map(m => (
              <div key={`${m.date}-${m.home}-${m.away}`} className="text-xs text-faint tabular-nums">
                {m.date} · {m.home} {m.homeScore} - {m.awayScore} {m.away}
              </div>
            ))}
          </div>
        )}
        <SectionHeading>{t('momentum')}</SectionHeading>
        <div className="flex flex-col gap-1.5">
          <MomentumRow label={home} pct={momentum.homePct} />
          <MomentumRow label={away} pct={momentum.awayPct} />
        </div>
      </CardBody>
    </Card>
  )
}

function SuperCombo({ probabilities, mode, analyst }: { probabilities: Record<string, Record<string, number>>; mode: DisplayMode; analyst: boolean }) {
  const { t, locale } = useLanguage()
  const combo = getSuperCombo(probabilities)

  return (
    <Card className="mb-4">
      <CardBody>
        <CardTitle className="mb-3">{t('superCombo')}</CardTitle>
        {combo.legs.length === 0 ? (
          <p className="m-0 text-sm text-faint">{t('superComboEmpty')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
              {combo.legs.map(leg => (
                <div key={leg.market} className="rounded-lg border border-border bg-surface-alt/50 px-3 py-2.5 text-sm">
                  <div className="mb-1 text-xs text-muted">
                    {getMarketLabel(leg.market, locale)}{analyst ? ` · ${leg.market}` : ''}
                  </div>
                  <div className="font-semibold text-foreground">{getOutcomeLabel(leg.market, leg.outcome, locale)}</div>
                  <div className="font-semibold text-primary-strong tabular-nums">
                    {mode === 'odds' ? formatDecimal(leg.prob) : formatProb(leg.prob)}
                  </div>
                </div>
              ))}
            </div>
            {combo.legs.length < 3 && (
              <p className="mt-2 mb-0 text-xs text-faint">{t('superComboPartial')}</p>
            )}
            {combo.estimate !== null && (
              <p className="mt-1 mb-0 text-xs text-faint">
                {t('superComboEstimate')}: {formatProb(combo.estimate)}
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

interface PredictionPanelProps {
  prediction: Prediction
  selectedMarket: string
  onMarketChange: (market: string) => void
  home: string
  away: string
  fixtures: Fixture[]
  analyst: boolean
  // Inside a match story card the verdict hero already covers the title
  // and probable score; bare hides those duplicates.
  bare?: boolean
  // Prefetched stored odds; when undefined the checker loads them itself.
  initialValue?: ValueResponse | null
}

export default function PredictionPanel({ prediction, selectedMarket, onMarketChange, home, away, fixtures, analyst, bare = false, initialValue }: PredictionPanelProps) {
  const { t, locale } = useLanguage()
  const [mode, setMode] = useDisplayMode()
  const moves = useMovement(prediction.fixture_id, selectedMarket, prediction.probabilities[selectedMarket])
  const availableMarkets = Object.keys(prediction.probabilities)

  return (
    <div>
      {!bare && (
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t('prediction')}</h2>
      )}

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {analyst && (
            <span className="text-muted">
              {t('model')}: <span className="font-medium text-foreground">{prediction.model_version}</span>
              {' | '}
              {t('agreement')}: <span className="font-medium text-primary-strong">{formatProb(prediction.model_agreement)}</span>
            </span>
          )}
          {!bare && prediction.probable_score && (
            <span className="text-muted">
              {t('probableScore')}{' '}
              <Badge variant="accent" className="px-3 py-1 font-mono text-sm">
                {prediction.probable_score.home} - {prediction.probable_score.away}
              </Badge>
            </span>
          )}
        </CardBody>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-55">
          <MarketSelector selected={selectedMarket} onChange={onMarketChange} availableMarkets={availableMarkets} analyst={analyst} />
        </div>
        <DisplayModeToggle mode={mode} onChange={setMode} />
      </div>

      <Card className="mb-4">
        <CardBody>
          <CardTitle className="mb-3">
            {getMarketLabel(selectedMarket, locale)}{analyst ? ` · ${selectedMarket}` : ''}
          </CardTitle>
          <MarketRenderer market={selectedMarket} probabilities={prediction.probabilities} mode={mode} moves={moves} />
        </CardBody>
      </Card>

      <MatchCenter home={home} away={away} fixtures={fixtures} />
      <SuperCombo probabilities={prediction.probabilities} mode={mode} analyst={analyst} />
      <ValueChecker fixtureId={prediction.fixture_id} home={home} away={away} autoResult={initialValue} />

      {analyst && prediction.top_features && prediction.top_features.length > 0 && (
        <Card>
          <CardBody>
            <CardTitle className="mb-3">{t('topFeatures')}</CardTitle>
            <Table>
              <tbody>
                {prediction.top_features.map((f, i) => (
                  <tr key={i} className="transition-colors hover:bg-surface-hover">
                    <Th scope="row" className="font-normal text-muted">{toTitleCase(f.feature)}</Th>
                    <Td align="right" className="font-medium">
                      {typeof f.value === 'number' ? f.value.toFixed(3) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

import type { Fixture, Prediction, TeamContext, ValueResponse } from '../types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchContext } from '../api'
import { fillVars, useLanguage } from '../i18n'
import { useDisplayMode, type DisplayMode } from '../hooks/useDisplayMode'
import { useMovement, type MoveDirection } from '../hooks/useMovement'
import { formatDecimal } from '../utils/odds'
import { getMarketLabel, getOutcomeLabel } from '../utils/marketLabels'
import {
  getTeamForm,
  getHeadToHead,
  getMomentum,
  getSuperCombo,
  type FormOutcome,
} from '../utils/matchCenter'
import { displayTeam } from '../utils/teamNames'
import MarketRenderer from './MarketRenderer'
import MarketSelector from './MarketSelector'
import ValueChecker from './ValueChecker'
import { Badge } from './ui/badge'
import { Card, CardBody, CardTitle, SectionHeading } from './ui/card'
import { Input } from './ui/input'
import { Table, Td, Th } from './ui/table'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

// Internal model names leak as snake_case; present them as titles.
function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function FormBadges({ form, emptyLabel }: { form: FormOutcome[]; emptyLabel: string }) {
  const { t, locale } = useLanguage()
  const word = (o: FormOutcome) => (o === 'W' ? t('formWin') : o === 'D' ? t('formDraw') : t('formLoss'))
  // Visible letters follow the UI language (form comes most-recent-first).
  const letter = (o: FormOutcome) => (locale === 'es' ? (o === 'W' ? 'V' : o === 'D' ? 'E' : 'D') : o)
  if (form.length === 0) {
    return <span className="text-xs text-faint">{emptyLabel}</span>
  }
  return (
    <span className="inline-flex items-center gap-1" role="list" aria-label={t('formLegend')}>
      {form.map((o, i) => (
        <Badge
          key={i}
          role="listitem"
          aria-label={word(o)}
          title={word(o)}
          variant={o === 'W' ? 'success' : o === 'D' ? 'neutral' : 'danger'}
          className="min-w-7 justify-center font-mono"
        >
          {letter(o)}
        </Badge>
      ))}
    </span>
  )
}

function MomentumRow({ label, points, max, pct }: { label: string; points: number; max: number; pct: number }) {
  const { t } = useLanguage()
  return (
    <div
      className="relative flex min-h-11 items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-surface px-3 py-2 text-sm"
      title={fillVars(t('recentPointsHint'), { n: max / 3 })}
    >
      <div className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      <span className="relative z-10 font-medium text-foreground">{label}</span>
      <span className="relative z-10 text-muted tabular-nums">
        {fillVars(t('pointsOf'), { points, max })} · {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function MatchCenter({ home, away, fixtures }: { home: string; away: string; fixtures: Fixture[] }) {
  const { t, locale } = useLanguage()
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
  const homeLabel = displayTeam(home)
  const awayLabel = displayTeam(away)
  // Real sample size behind the "last N" labels (5 = default window when empty).
  const formWindow = Math.max(homeForm.length, awayForm.length) || 5
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${iso}T12:00:00`),
    )

  return (
    <Card className="mb-4">
      <CardBody>
        <CardTitle className="mb-3">{t('matchCenter')}</CardTitle>
        <SectionHeading level={4} className="flex items-center justify-between gap-2">
          <span>{t('form')} · {fillVars(t('lastN'), { n: formWindow })}</span>
          <span className="text-[11px] font-normal normal-case tracking-normal">{t('newestFirst')}</span>
        </SectionHeading>
        <div className="mb-3 flex flex-col divide-y divide-border/60">
          <div className="flex items-center justify-between gap-2 py-1.5">
            <Link
              to={`/equipo/${encodeURIComponent(home)}`}
              className="rounded-md text-sm text-foreground underline decoration-border-strong underline-offset-2 hover:text-primary-strong"
            >
              {homeLabel}
            </Link>
            <FormBadges form={homeForm} emptyLabel={t('noFormData')} />
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5">
            <Link
              to={`/equipo/${encodeURIComponent(away)}`}
              className="rounded-md text-sm text-foreground underline decoration-border-strong underline-offset-2 hover:text-primary-strong"
            >
              {awayLabel}
            </Link>
            <FormBadges form={awayForm} emptyLabel={t('noFormData')} />
          </div>
        </div>
        <SectionHeading level={4}>{t('headToHead')}</SectionHeading>
        {h2h.meetings.length === 0 ? (
          <p className="mb-3 text-xs text-faint">{t('noH2H')}</p>
        ) : (
          <div className="mb-3">
            <div className="mb-1 text-sm font-semibold text-foreground">
              {fillVars(t('h2hSummary'), { home: homeLabel, homeWins: h2h.homeWins, draws: h2h.draws, away: awayLabel, awayWins: h2h.awayWins })}
            </div>
            <div className="flex flex-col divide-y divide-border/60">
              {h2h.meetings.map(m => (
                <div key={`${m.date}-${m.home}-${m.away}`} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-1 text-xs text-faint tabular-nums">
                  <span className="truncate">{shortDate(m.date)}</span>
                  <span className="min-w-0 truncate">
                    {displayTeam(m.home)} {m.homeScore} - {m.awayScore} {displayTeam(m.away)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <SectionHeading level={4}>{t('recentPoints')}</SectionHeading>
        <p className="mt-0 mb-2 text-xs text-faint">{fillVars(t('recentPointsHint'), { n: formWindow })}</p>
        <div className="flex flex-col gap-2">
          <MomentumRow label={homeLabel} points={momentum.homePoints} max={momentum.maxPoints} pct={momentum.homePct} />
          <MomentumRow label={awayLabel} points={momentum.awayPoints} max={momentum.maxPoints} pct={momentum.awayPct} />
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
                <div key={leg.market} className="rounded-lg border border-border bg-surface-alt/50 px-3 py-2 text-sm">
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
            <p className="mt-1 mb-0 text-xs text-faint">{t('superComboHint')}</p>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function MarketsBlock({ marketLayout, selectedMarket, onMarketChange, availableMarkets, analyst, prediction, mode, moves, query, onQueryChange }: {
  marketLayout: 'stack' | 'parallel'
  selectedMarket: string
  onMarketChange: (market: string) => void
  availableMarkets: string[]
  analyst: boolean
  prediction: Prediction
  mode: DisplayMode
  moves: Record<string, MoveDirection>
  query?: string
  onQueryChange?: (q: string) => void
}) {
  const { t, locale } = useLanguage()
  return (
    <>
      <div className={marketLayout === 'parallel' ? 'mb-3 grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start' : 'mb-3'}>
        <MarketSelector selected={selectedMarket} onChange={onMarketChange} availableMarkets={availableMarkets} analyst={analyst} singleColumn={marketLayout === 'parallel'} query={query} onQueryChange={onQueryChange} />

        {/* Mercados heading removed as per user feedback: redundant with tab Mercados and accordion titles.
             Keep live region for mode announcements. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {mode === 'prob' ? 'Mostrando probabilidades' : 'Mostrando cuotas'}
        </div>

        <Card className={marketLayout === 'parallel' ? 'mb-4 xl:sticky xl:top-[150px]' : 'mb-4'}>
          <CardBody>
            <CardTitle className="mb-3">
              {getMarketLabel(selectedMarket, locale)}{analyst ? ` · ${selectedMarket}` : ''}
            </CardTitle>
            <MarketRenderer market={selectedMarket} probabilities={prediction.probabilities} mode={mode} moves={moves} />
            {Object.values(moves).some(m => m !== 'flat') && (
              <p className="mt-2 mb-0 text-xs text-faint" aria-hidden="true">
                ▲ {t('oddsUp')} · ▼ {t('oddsDown')}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
      <SuperCombo probabilities={prediction.probabilities} mode={mode} analyst={analyst} />
    </>
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
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
  // Parallel shows selector + chart side by side (xl+) with a sticky chart
  // so options can be compared live; stack keeps the current sequential flow.
  marketLayout?: 'stack' | 'parallel'
  // Tabs split the story into Mercados (default) / Contexto / Valor so the
  // page shows one block at a time; stack keeps the sequential flow.
  storyTabs?: boolean
}

type StoryTab = 'markets' | 'context' | 'value'

const STORY_TABS: StoryTab[] = ['markets', 'context', 'value']

export default function PredictionPanel({ prediction, selectedMarket, onMarketChange, home, away, fixtures, analyst, bare = false, initialValue, displayMode, onDisplayModeChange, marketLayout = 'stack', storyTabs = false }: PredictionPanelProps) {
  const { t } = useLanguage()
  const [internalMode, setInternalMode] = useDisplayMode()
  const mode = displayMode ?? internalMode
  const setMode = onDisplayModeChange ?? setInternalMode
  void setMode
  const moves = useMovement(prediction.fixture_id, selectedMarket, prediction.probabilities[selectedMarket])
  const availableMarkets = Object.keys(prediction.probabilities)
  const [tab, setTab] = useState<StoryTab>('markets')
  const [marketQuery, setMarketQuery] = useState('')
  const [tabFixture, setTabFixture] = useState(prediction.fixture_id)
  if (tabFixture !== prediction.fixture_id) {
    setTabFixture(prediction.fixture_id)
    setTab('markets')
    setMarketQuery('')
  }
  const handleMarketQuery = (q: string) => {
    setMarketQuery(q)
    setTab('markets')
  }

  return (
    <div>
      {!bare && (
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t('prediction')}</h2>
      )}

      {(analyst || (!bare && prediction.probable_score)) && (
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
      )}

      {storyTabs ? (
        <>
          <div role="tablist" aria-label={t('sectionMarkets')} className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-surface p-1.5 shadow-sm">
            {STORY_TABS.map(key => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`storytab-${prediction.fixture_id}-${key}`}
                aria-selected={tab === key}
                aria-controls={`storypanel-${prediction.fixture_id}-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={e => {
                  const i = STORY_TABS.indexOf(key)
                  let next: number | null = null
                  if (e.key === 'ArrowRight') next = (i + 1) % STORY_TABS.length
                  else if (e.key === 'ArrowLeft') next = (i - 1 + STORY_TABS.length) % STORY_TABS.length
                  else if (e.key === 'Home') next = 0
                  else if (e.key === 'End') next = STORY_TABS.length - 1
                  if (next !== null) {
                    e.preventDefault()
                    setTab(STORY_TABS[next])
                    document.getElementById(`storytab-${prediction.fixture_id}-${STORY_TABS[next]}`)?.focus()
                  }
                }}
                className={`min-h-11 shrink-0 cursor-pointer rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === key ? 'bg-foreground text-background' : 'text-muted hover:bg-foreground hover:text-background'}`}
              >
                {key === 'markets' ? t('sectionMarkets') : key === 'context' ? t('tabContext') : t('tabValue')}
              </button>
            ))}
            {tab === 'markets' && (
              <div className="ml-auto w-full sm:w-52">
                <Input
                  type="search"
                  value={marketQuery}
                  onChange={e => handleMarketQuery(e.target.value)}
                  placeholder={t('marketSearch')}
                  aria-label={t('marketSearch')}
                />
              </div>
            )}
          </div>
          <div role="tabpanel" id={`storypanel-${prediction.fixture_id}-markets`} aria-labelledby={`storytab-${prediction.fixture_id}-markets`} hidden={tab !== 'markets'}>
            <MarketsBlock
              marketLayout={marketLayout}
              selectedMarket={selectedMarket}
              onMarketChange={onMarketChange}
              availableMarkets={availableMarkets}
              analyst={analyst}
              prediction={prediction}
              mode={mode}
              moves={moves}
              query={marketQuery}
              onQueryChange={handleMarketQuery}
            />
          </div>
          <div role="tabpanel" id={`storypanel-${prediction.fixture_id}-context`} aria-labelledby={`storytab-${prediction.fixture_id}-context`} hidden={tab !== 'context'}>
            <MatchCenter home={home} away={away} fixtures={fixtures} />
          </div>
          <div role="tabpanel" id={`storypanel-${prediction.fixture_id}-value`} aria-labelledby={`storytab-${prediction.fixture_id}-value`} hidden={tab !== 'value'}>
            <ValueChecker fixtureId={prediction.fixture_id} home={home} away={away} autoResult={initialValue} />
          </div>
        </>
      ) : (
        <>
          <MarketsBlock
            marketLayout={marketLayout}
            selectedMarket={selectedMarket}
            onMarketChange={onMarketChange}
            availableMarkets={availableMarkets}
            analyst={analyst}
            prediction={prediction}
            mode={mode}
            moves={moves}
          />
          <MatchCenter home={home} away={away} fixtures={fixtures} />
          <ValueChecker fixtureId={prediction.fixture_id} home={home} away={away} autoResult={initialValue} />
        </>
      )}

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

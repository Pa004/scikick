import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Fixture, TeamContext } from '../types'
import { fetchContext } from '../api'
import { fillVars, useLanguage } from '../i18n'
import {
  getTeamForm,
  getHeadToHead,
  getMomentum,
  type FormOutcome,
} from '../utils/matchCenter'
import { displayTeam } from '../utils/teamNames'
import { formLetter } from '../utils/form'
import { Badge } from './ui/badge'
import { Card, CardBody, CardTitle, SectionHeading } from './ui/card'

function FormBadges({ form, emptyLabel }: { form: FormOutcome[]; emptyLabel: string }) {
  const { t, locale } = useLanguage()
  const word = (o: FormOutcome) => (o === 'W' ? t('formWin') : o === 'D' ? t('formDraw') : t('formLoss'))
  // Visible letters follow the UI language (form comes most-recent-first).
  const letter = (o: FormOutcome) => formLetter(o, locale)
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

interface MatchCenterProps {
  home: string
  away: string
  fixtures: Fixture[]
  // Server context from the story bundle. When both are undefined the
  // component fetches them itself; provided nulls mean "failed", so the
  // local fixtures are used as fallback without refetching.
  bundleHome?: TeamContext | null
  bundleAway?: TeamContext | null
}

export function MatchCenter({ home, away, fixtures, bundleHome, bundleAway }: MatchCenterProps) {
  const { t, locale } = useLanguage()
  const useBundle = bundleHome !== undefined || bundleAway !== undefined
  const [localHome, setLocalHome] = useState<TeamContext | null>(null)
  const [localAway, setLocalAway] = useState<TeamContext | null>(null)

  useEffect(() => {
    if (useBundle) return
    let active = true
    setLocalHome(null)
    setLocalAway(null)
    Promise.all([
      fetchContext(home, away).catch(() => null),
      fetchContext(away, home).catch(() => null),
    ]).then(([h, a]) => {
      if (!active) return
      setLocalHome(h)
      setLocalAway(a)
    })
    return () => {
      active = false
    }
  }, [home, away, useBundle])

  const serverHome = useBundle ? (bundleHome ?? null) : localHome
  const serverAway = useBundle ? (bundleAway ?? null) : localAway

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

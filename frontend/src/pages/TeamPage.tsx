import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Fixture, TeamContext } from '../types'
import { fetchContext, fetchFixtures } from '../api'
import { recordVisit } from '../lib/visits'
import { useLanguage } from '../i18n'
import { displayTeam } from '../utils/teamNames'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { LEAGUES } from '../components/layout/LeagueSwitcher'
import { MatchCard } from '../components/feed/MatchCard'
import { TeamAvatar } from '../components/feed/TeamAvatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getCachedValue } from '../api/detail'

function recordLine(form: TeamContext['form']): string {
  const w = form.filter(f => f.result === 'W').length
  const d = form.filter(f => f.result === 'D').length
  const l = form.filter(f => f.result === 'L').length
  return `${w} - ${d} - ${l}`
}

export function TeamPage() {
  const { t } = useLanguage()
  const { name } = useParams()
  const team = decodeURIComponent(name ?? '')
  const [analyst] = useAnalystMode()
  const { followed, toggle } = useFollowedTeams()
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)
  const [context, setContext] = useState<TeamContext | null>(null)
  const [failed, setFailed] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setFixtures(null)
    setContext(null)
    setFailed(false)
    setExpandedId(null)
    if (!team) {
      setFailed(true)
      return
    }
    Promise.all([
      fetchFixtures('all', 200).catch((): Fixture[] => []),
      fetchContext(team).catch((): null => null),
    ]).then(([all, ctx]) => {
      if (!active) return
      setFixtures(all)
      setContext(ctx)
      if (all.length === 0 && ctx === null) setFailed(true)
      else recordVisit({ kind: 'team', id: team, label: team })
    })
    return () => {
      active = false
    }
  }, [team])

  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  const teamFixtures = useMemo(
    () => (fixtures ?? []).filter(f => f.home === team || f.away === team),
    [fixtures, team],
  )
  const upcoming = useMemo(
    () => teamFixtures.filter(f => f.status !== 'post').sort((a, b) => a.date.localeCompare(b.date)),
    [teamFixtures],
  )

  if (fixtures === null && !failed) {
    return (
      <main id="main-content">
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </main>
    )
  }

  if (failed || teamFixtures.length === 0) {
    return (
      <main id="main-content">
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p className="mb-2 font-medium">{t('teamNotFound')}</p>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link to="/">{t('backToFeed')}</Link>
          </Button>
        </div>
      </main>
    )
  }

  const form = context?.form ?? []
  const crest = context?.crest ?? teamFixtures.find(f => f.home === team)?.home_crest
    ?? teamFixtures.find(f => f.away === team)?.away_crest
    ?? null
  const isFollowed = followed.includes(team)

  return (
    <main id="main-content">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <TeamAvatar team={team} crest={crest} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-bold tracking-tight text-foreground" title={displayTeam(team)}>
            {displayTeam(team)}
          </h2>
          {form.length > 0 && (
            <p className="mt-1 text-sm text-muted tabular-nums">
              {t('form')} · {t('last5')}: {recordLine(form)}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={isFollowed ? 'primary' : 'secondary'}
          aria-pressed={isFollowed}
          onClick={() => toggle(team)}
        >
          {isFollowed ? t('unfollowTeam').replace('{team}', displayTeam(team)) : t('followTeam').replace('{team}', displayTeam(team))}
        </Button>
      </div>

      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">{t('upcoming')}</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-faint">{t('noUpcoming')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.map(f => {
            const entry = getCachedValue(f.id)
            return (
              <MatchCard
                key={f.id}
                fixture={f}
                expanded={expandedId === f.id}
                onToggle={() => setExpandedId(prev => (prev === f.id ? null : f.id))}
                leagueName={leagueName(f.league)}
                followed={followed}
                onToggleFollow={toggle}
                hasValue={entry === undefined ? null : entry !== null && Object.values(entry.outcomes).some(o => o.value)}
                analyst={analyst}
                fixtures={fixtures ?? []}
              />
            )
          })}
        </div>
      )}
      {form.length > 0 && (
        <div className="mt-4">
          <Badge variant="neutral">
            {t('form')} {recordLine(form)} · {t('last5')}
          </Badge>
        </div>
      )}
    </main>
  )
}

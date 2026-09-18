import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Fixture, TeamContext } from '../types'
import { fetchContext, fetchFixtures } from '../api'
import { recordVisit } from '../lib/visits'
import { useLanguage } from '../i18n'
import { displayTeam } from '../utils/teamNames'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { useLeagueName } from '../hooks/useLeagueName'
import { MatchCard, FormStrip } from '../components/feed/MatchCard'
import { TeamAvatar } from '../components/feed/TeamAvatar'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getCachedValue } from '../api/detail'
import type { FormOutcome } from '../utils/matchCenter'

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
      fetchFixtures('all', 200, true).catch((): Fixture[] => []),
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

  const leagueName = useLeagueName()

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
        <div role="alert" className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-ink">
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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-4">
        <TeamAvatar team={team} crest={crest} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-bold text-foreground" title={displayTeam(team)}>
            {displayTeam(team)}
          </h1>
          {form.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <FormStrip
                form={form.map(f => f.result) as FormOutcome[]}
                label={`${displayTeam(team)}: ${t('form')}`}
              />
              <span className="text-[13px] text-faint">{t('last5')}</span>
            </div>
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

      <h3 className="mb-3 text-xl font-bold text-foreground">{t('upcoming')}</h3>
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
    </main>
  )
}

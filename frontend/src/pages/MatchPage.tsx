import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Fixture } from '../types'
import { fetchFixtures } from '../api'
import { getCachedValue, prefetchValues } from '../api/detail'
import { recordVisit } from '../lib/visits'
import { useLanguage } from '../i18n'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { LEAGUES } from '../components/layout/LeagueSwitcher'
import { MatchCard, FollowStar, FormStrip } from '../components/feed/MatchCard'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getTeamForm } from '../utils/matchCenter'
import { formatHumanDate } from '../components/fixtures/fixtureUtils'
import { displayTeam } from '../utils/teamNames'

export function MatchPage() {
  const { t, locale } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams()
  const fixtureId = Number(id)
  const [analyst] = useAnalystMode()
  const { followed, toggle } = useFollowedTeams()
  const [meta, setMeta] = useState<Fixture | null | undefined>(undefined)
  const [contextFixtures, setContextFixtures] = useState<Fixture[]>([])
  const [, setValuesTick] = useState(0)

  useEffect(() => {
    let active = true
    setMeta(undefined)
    setContextFixtures([])
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      setMeta(null)
      return
    }
    fetchFixtures('all', 200)
      .then(all => {
        if (!active) return
        const found = all.find(f => f.id === fixtureId) ?? null
        setMeta(found)
        if (found) {
          setContextFixtures(all.filter(f => f.league === found.league))
          recordVisit({
            kind: 'match',
            id: String(found.id),
            label: `${found.home} vs ${found.away}`,
            sub: found.league,
          })
          void prefetchValues([found.id]).then(() => {
            if (active) setValuesTick(x => x + 1)
          })
        }
      })
      .catch(() => {
        if (active) setMeta(null)
      })
    return () => {
      active = false
    }
  }, [fixtureId])

  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  if (meta === undefined) {
    return (
      <main id="main-content">
        <div role="status" aria-label={t('loadingMatch')} className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </main>
    )
  }

  if (meta === null) {
    return (
      <main id="main-content">
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          <p className="mb-2 font-medium">{t('deepLinkMiss')}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/')}>
            {t('backToFeed')}
          </Button>
        </div>
      </main>
    )
  }

  const entry = getCachedValue(meta.id)
  const hasValue = entry === undefined
    ? null
    : entry === null
      ? false
      : Object.values(entry.outcomes).some(o => o.value)

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <div className="min-w-0">
        <MatchCard
          fixture={meta}
          expanded
          onToggle={() => navigate('/')}
          leagueName={leagueName(meta.league)}
          followed={followed}
          onToggleFollow={toggle}
          hasValue={hasValue}
          analyst={analyst}
          fixtures={contextFixtures}
        />
      </div>
      <aside aria-label={t('matchContext')} className="mt-6 hidden min-w-0 lg:mt-0 lg:block">
        <div className="sticky top-32 space-y-4">
          <section aria-label={t('matchMeta')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{t('matchMeta')}</h2>
            <p className="text-sm font-semibold text-foreground">{leagueName(meta.league)}</p>
            <p className="text-sm text-muted">{formatHumanDate(meta.date, locale)}</p>
            {hasValue === true && (
              <Badge variant="info" className="mt-2 text-xs">{t('valueIsValue')}</Badge>
            )}
          </section>
          <section aria-label={t('form')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{t('form')}</h2>
            <div className="space-y-2">
              {[
                { team: meta.home, form: getTeamForm(contextFixtures, meta.home) },
                { team: meta.away, form: getTeamForm(contextFixtures, meta.away) },
              ].map(({ team, form }) => (
                <div key={team} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-foreground">{displayTeam(team)}</span>
                  {form.length > 0 && <FormStrip form={form} label={`${displayTeam(team)}: ${t('form')}`} />}
                </div>
              ))}
            </div>
          </section>
          <section aria-label={t('myMatches')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{t('myMatches')}</h2>
            <div className="flex items-center gap-1">
              <FollowStar team={meta.home} followed={followed} onToggle={() => toggle(meta.home)} />
              <span className="text-sm text-muted">{displayTeam(meta.home)}</span>
            </div>
            <div className="flex items-center gap-1">
              <FollowStar team={meta.away} followed={followed} onToggle={() => toggle(meta.away)} />
              <span className="text-sm text-muted">{displayTeam(meta.away)}</span>
            </div>
          </section>
        </div>
      </aside>
    </main>
  )
}

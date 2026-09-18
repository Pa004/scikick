import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Fixture } from '../types'
import { fetchFixtures } from '../api'
import { getCachedValue, prefetchValues } from '../api/detail'
import { recordVisit } from '../lib/visits'
import { useLanguage } from '../i18n'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { useLeagueName } from '../hooks/useLeagueName'
import { ArrowLeft, Star } from 'lucide-react'
import { MatchCard, FormStrip } from '../components/feed/MatchCard'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getTeamForm } from '../utils/matchCenter'
import { displayTeam } from '../utils/teamNames'
import { cn } from '../lib/cn'
import DisplayModeToggle from '../components/DisplayModeToggle'
import { useDisplayMode } from '../hooks/useDisplayMode'

export function MatchPage() {
  const { t, locale } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams()
  const fixtureId = Number(id)
  const [analyst] = useAnalystMode()
  const { followed, toggle } = useFollowedTeams()
  const [displayMode, setDisplayMode] = useDisplayMode()
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


  const leagueName = useLeagueName()

  if (meta === undefined) {
    return (
      <main id="main-content" className="w-full">
        <div role="status" aria-label={t('loadingMatch')} className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </main>
    )
  }

  if (meta === null) {
    return (
      <main id="main-content" className="w-full">
        <div role="alert" className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-ink">
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

  const formHome = getTeamForm(contextFixtures, meta.home)
  const formAway = getTeamForm(contextFixtures, meta.away)
  const hasForm = formHome.length > 0 || formAway.length > 0
  const isFollowed = followed.includes(meta.home) || followed.includes(meta.away)
  const followLabel = isFollowed ? t('unfollowMatch') : t('followMatch')
  const handleFollowToggle = () => {
    if (isFollowed) {
      if (followed.includes(meta.home)) toggle(meta.home)
      if (followed.includes(meta.away)) toggle(meta.away)
    } else {
      toggle(meta.home)
    }
  }

  return (
    <main id="main-content" className="w-full">
      <h1 className="sr-only">
        {displayTeam(meta.home)} vs {displayTeam(meta.away)}
      </h1>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm font-medium text-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
        <span className="whitespace-nowrap">{t('backToFeed')}</span>
      </button>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <div className="min-w-0">
        <MatchCard
          fixture={meta}
          expanded
          hideDate
          hideLeague
          onToggle={() => navigate('/')}
          leagueName={leagueName(meta.league)}
          followed={followed}
          onToggleFollow={toggle}
          hasValue={hasValue}
          analyst={analyst}
          fixtures={contextFixtures}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          marketLayout="parallel"
          storyTabs
        />
      </div>
      <aside aria-label={t('matchContext')} className="mt-6 hidden min-w-0 lg:mt-0 lg:block">
        <div className="sticky top-[136px] space-y-4">
          <section aria-label={t('matchMeta')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="border-b border-border pb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{t('matchMeta')}</h2>
            <div className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Serie</span>
                <p className="text-sm font-semibold text-foreground">{leagueName(meta.league)}</p>
              </div>
              <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Fecha</span>
                <p className="text-sm text-muted">{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(meta.date + 'T12:00:00'))}</p>
              </div>
              {hasValue === true && (
                <div className="flex flex-col gap-1 border-l-2 border-value/30 pl-3">
                  <span className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Valor</span>
                  <Badge variant="value" className="w-fit text-xs" title="Valor esperado positivo: el modelo estima más probabilidad que la cuota implícita">{t('valueIsValue')}</Badge>
                  <p className="text-xs leading-snug text-muted">Cuota con valor esperado +</p>
                </div>
              )}
            </div>
          </section>
          {hasForm && (
            <section aria-label={t('form')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">{t('form')}</h2>
              <div className="space-y-2">
                {[
                  { team: meta.home, form: formHome },
                  { team: meta.away, form: formAway },
                ].map(({ team, form }) => (
                  <div key={team} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-foreground">{displayTeam(team)}</span>
                    <FormStrip form={form} label={`${displayTeam(team)}: ${t('form')}`} />
                  </div>
                ))}
              </div>
            </section>
          )}
          <section aria-label={t('myMatches')} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <button
              type="button"
              onClick={handleFollowToggle}
              aria-pressed={isFollowed}
              aria-label={followLabel}
              className={cn(
                'flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isFollowed ? 'bg-foreground text-background' : 'bg-surface text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              <Star aria-hidden="true" className="size-4 shrink-0" fill={isFollowed ? 'currentColor' : 'none'} />
              <span className="truncate">{isFollowed ? t('unfollowMatch') : t('followMatch')}</span>
            </button>
            <div className="my-2 h-px bg-border/60" />
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex w-full items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{t('backToFeed')}</span>
            </button>
          </section>
          <section aria-label={t('displayModeLabel')} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
            <div className="flex justify-center">
              <DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />
            </div>
          </section>
        </div>
      </aside>
      </div>
    </main>
  )
}

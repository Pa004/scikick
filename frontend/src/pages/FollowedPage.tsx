import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Fixture } from '../types'
import { fetchFixtures } from '../api'
import { useLanguage } from '../i18n'
import { displayTeam } from '../utils/teamNames'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { LEAGUES } from '../components/layout/LeagueSwitcher'
import { MatchCard } from '../components/feed/MatchCard'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getCachedValue } from '../api/detail'

export function FollowedPage() {
  const { t } = useLanguage()
  const [analyst] = useAnalystMode()
  const { followed, toggle } = useFollowedTeams()
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetchFixtures('all', 200)
      .then(all => {
        if (active) setFixtures(all)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  const leagueName = (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }

  if (fixtures === null && !failed) {
    return (
      <main id="main-content">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{t('myMatches')}</h2>
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </main>
    )
  }

  if (failed) {
    return (
      <main id="main-content">
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <p className="m-0 font-medium">{t('backendError')}</p>
        </div>
      </main>
    )
  }

  const mine = (fixtures ?? [])
    .filter(f => f.status !== 'post' && (followed.includes(f.home) || followed.includes(f.away)))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <main id="main-content">
      <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{t('myMatches')}</h2>
      {followed.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted shadow-sm">
          <p className="mb-3">{t('noFollowed')}</p>
          <Button type="button" variant="secondary" asChild>
            <Link to="/">{t('backToFeed')}</Link>
          </Button>
        </div>
      ) : mine.length === 0 ? (
        <p role="status" className="text-sm text-faint">{t('noFixtures')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {mine.map(f => {
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
      {followed.length > 0 && (
        <p className="mt-3 text-xs text-faint">
          {followed.map(displayTeam).join(' · ')}
        </p>
      )}
    </main>
  )
}

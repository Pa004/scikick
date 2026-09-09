import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Fixture } from '../types'
import { fetchFixtures } from '../api'
import { getCachedValue, prefetchValues } from '../api/detail'
import { useLanguage } from '../i18n'
import { useAnalystMode } from '../hooks/useAnalystMode'
import { useFollowedTeams } from '../hooks/useFollowedTeams'
import { LEAGUES } from '../components/layout/LeagueSwitcher'
import { MatchCard } from '../components/feed/MatchCard'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'

export function MatchPage() {
  const { t } = useLanguage()
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
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
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
    <main id="main-content" className="mx-auto w-full max-w-3xl">
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
    </main>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage, fillVars } from '../../i18n'
import { getCachedValue, prefetchValues } from '../../api/detail'
import { matchesQuery } from '../fixtures/fixtureUtils'
import { getDeepLinkedFixtureId, syncDeepLink } from '../../lib/deeplink'
import { selectPickOfDay } from '../../utils/matchCenter'
import { MatchCard } from './MatchCard'
import { PickOfDayCard } from '../fixtures/PickOfDayCard'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { SegmentedButton, SegmentedGroup } from '../ui/segmented'
import { Skeleton } from '../ui/skeleton'

// Top predicted cards get their +EV badge without opening the story.
const PREFETCH_COUNT = 15
const PAGE_SIZE = 20

function hasStoredValue(id: number): boolean | null {
  const entry = getCachedValue(id)
  if (entry === undefined) return null
  if (entry === null) return false
  return Object.values(entry.outcomes).some(o => o.value)
}

function scrollCardIntoView(id: number) {
  requestAnimationFrame(() => {
    try {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document
        .getElementById(`match-card-${id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    } catch {
      // Non-visual env: expanding still works
    }
  })
}

interface FeedBoardProps {
  fixtures: Fixture[]
  loading: boolean
  leagueName: (code: string) => string
  followed: string[]
  onToggleFollow: (team: string) => void
  analyst: boolean
  fixturesForContext: Fixture[]
}

export function FeedBoard({
  fixtures,
  loading,
  leagueName,
  followed,
  onToggleFollow,
  analyst,
  fixturesForContext,
}: FeedBoardProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [showFollowed, setShowFollowed] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [valuesReady, setValuesReady] = useState(false)
  const [deepLinkMiss, setDeepLinkMiss] = useState(false)

  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      if (!matchesQuery(f, query)) return false
      if (showFollowed && !followed.includes(f.home) && !followed.includes(f.away)) return false
      if (showValue && hasStoredValue(f.id) !== true) return false
      return true
    })
  }, [fixtures, query, showFollowed, showValue, followed, valuesReady])

  const pick = useMemo(() => selectPickOfDay(filtered), [filtered])
  const visible = filtered.slice(0, visibleCount)

  // +EV badges for the top predicted stories, best-effort in background.
  useEffect(() => {
    if (loading || fixtures.length === 0) return
    let cancelled = false
    setValuesReady(false)
    const ranked = [...fixtures]
      .sort((a, b) => Number(b.prediction != null) - Number(a.prediction != null))
      .slice(0, PREFETCH_COUNT)
      .map(f => f.id)
    void prefetchValues(ranked).then(() => {
      if (!cancelled) setValuesReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [loading, fixtures])

  // Shareable link (?partido=) opens that story on load.
  useEffect(() => {
    if (loading || fixtures.length === 0) return
    const deepId = getDeepLinkedFixtureId()
    if (deepId === null) return
    if (fixtures.some(f => f.id === deepId)) {
      setExpandedId(deepId)
      scrollCardIntoView(deepId)
    } else {
      setDeepLinkMiss(true)
    }
    // Only on first load of this league feed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const toggle = (id: number) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id
      syncDeepLink(next)
      if (next !== null) scrollCardIntoView(next)
      return next
    })
  }

  const expandPick = (id: number) => {
    setExpandedId(id)
    syncDeepLink(id)
    scrollCardIntoView(id)
  }

  return (
    <div>
      <div role="search" className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          />
          <Input
            type="search"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            placeholder={t('searchFixtures')}
            aria-label={t('searchFixtures')}
            className="pl-9"
          />
        </div>
        {query && (
          <Button type="button" variant="secondary" onClick={() => setQuery('')}>
            <X aria-hidden="true" />
            {t('clearSearch')}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <SegmentedGroup label={t('fixtures')}>
          <SegmentedButton active={showFollowed} onClick={() => { setShowFollowed(v => !v); setVisibleCount(PAGE_SIZE) }}>
            {t('myMatches')}
          </SegmentedButton>
          <SegmentedButton active={showValue} onClick={() => { setShowValue(v => !v); setVisibleCount(PAGE_SIZE) }}>
            {t('valueOnly')}
          </SegmentedButton>
        </SegmentedGroup>
      </div>

      {deepLinkMiss && (
        <div role="alert" className="animate-fade mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
          <span className="flex-1">{t('deepLinkMiss')}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              syncDeepLink(null)
              setDeepLinkMiss(false)
            }}
          >
            {t('dismiss')}
          </Button>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label={t('loading')} aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p role="status" className="text-sm text-faint">
          {query.trim()
            ? t('noSearchResults')
            : showFollowed
              ? t('noFollowed')
              : showValue
                ? t('noValueMatches')
                : t('noFixtures')}
        </p>
      ) : (
        <>
          {!showFollowed && !showValue && query.trim() === '' && (
            <PickOfDayCard
              pick={pick}
              leagueName={leagueName}
              onSelect={expandPick}
            />
          )}
          <div className="flex flex-col gap-3">
            {visible.map(f => (
              <MatchCard
                key={f.id}
                fixture={f}
                expanded={expandedId === f.id}
                onToggle={() => toggle(f.id)}
                leagueName={leagueName(f.league)}
                followed={followed}
                onToggleFollow={onToggleFollow}
                hasValue={hasStoredValue(f.id)}
                analyst={analyst}
                fixtures={fixturesForContext}
              />
            ))}
          </div>
          <p aria-live="polite" className="mt-3 text-xs text-faint">
            {fillVars(t('showingMatches'), { shown: visible.length, total: filtered.length })}
          </p>
          {visible.length < filtered.length && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="mt-2 w-full"
            >
              {t('showMore')} ({filtered.length - visible.length})
            </Button>
          )}
        </>
      )}
    </div>
  )
}

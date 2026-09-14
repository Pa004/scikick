import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search, X } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage, fillVars } from '../../i18n'
import { getCachedValue, prefetchValues } from '../../api/detail'
import { matchesQuery, formatHumanDate } from '../fixtures/fixtureUtils'
import { parseDeepLinkId, syncDeepLink } from '../../lib/deeplink'
import { selectPickOfDay } from '../../utils/matchCenter'
import { MatchCard } from './MatchCard'
import { PickOfDayCard } from '../fixtures/PickOfDayCard'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { SegmentedButton, SegmentedGroup } from '../ui/segmented'
import { Skeleton } from '../ui/skeleton'

// Top predicted cards get their +EV badge without opening the story.
const PREFETCH_COUNT = 15
const PAGE_SIZE = 12
const SCROLL_KEY = 'scikick.feed-state'
const DESKTOP_QUERY = '(min-width: 1024px)'

interface SavedFeedState {
  y: number
  page: number
  query: string
}

function readSavedState(): SavedFeedState | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedFeedState> & { visibleCount?: number }
    if (typeof parsed.y !== 'number') return null
    // Backward compat: visibleCount → page
    const page = typeof parsed.page === 'number' ? parsed.page : typeof parsed.visibleCount === 'number' ? Math.max(1, Math.ceil(parsed.visibleCount / PAGE_SIZE)) : 1
    return { y: parsed.y, page, query: typeof parsed.query === 'string' ? parsed.query : '' }
  } catch {
    return null
  }
}

function isDesktopStory(): boolean {
  try {
    return window.matchMedia(DESKTOP_QUERY).matches
  } catch {
    return false
  }
}

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
  // When provided (routed feed), deep links navigate instead of expanding inline.
  onDeepLink?: (id: number) => void
}

export function FeedBoard({
  fixtures,
  loading,
  leagueName,
  followed,
  onToggleFollow,
  analyst,
  fixturesForContext,
  onDeepLink,
}: FeedBoardProps) {
  const { t, locale } = useLanguage()
  const [query, setQuery] = useState('')
  const [showFollowed, setShowFollowed] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [valuesReady, setValuesReady] = useState(false)
  const [deepLinkMiss, setDeepLinkMiss] = useState(false)
  const [searchParams] = useSearchParams()

  // Back from /partido/:id restores search and page once.
  useEffect(() => {
    const saved = readSavedState()
    if (!saved) return
    setQuery(saved.query)
    setCurrentPage(Math.max(1, saved.page))
    try {
      sessionStorage.removeItem(SCROLL_KEY)
    } catch {
      // Private mode: harmless if it persists
    }
    requestAnimationFrame(() => {
      try {
        window.scrollTo(0, saved.y)
      } catch {
        // Non-visual env
      }
    })
    // Only on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      if (!matchesQuery(f, query)) return false
      if (showFollowed && !followed.includes(f.home) && !followed.includes(f.away)) return false
      if (showValue && hasStoredValue(f.id) !== true) return false
      return true
    })
  }, [fixtures, query, showFollowed, showValue, followed, valuesReady])

  const pick = useMemo(() => selectPickOfDay(filtered), [filtered])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Clamp page if filters shrink total
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])
  const visible = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const groups = useMemo(() => {
    const byDate = new Map<string, Fixture[]>()
    for (const f of visible) {
      const items = byDate.get(f.date)
      if (items) items.push(f)
      else byDate.set(f.date, [f])
    }
    return [...byDate.entries()].map(([date, items]) => ({ date, items }))
  }, [visible])

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
    const deepId = parseDeepLinkId(`?${searchParams.toString()}`)
    if (deepId === null) return
    if (fixtures.some(f => f.id === deepId)) {
      if (onDeepLink) {
        onDeepLink(deepId)
      } else {
        // Ensure the deep-linked card is on the current pagination page
        const idx = filtered.findIndex(f => f.id === deepId)
        if (idx !== -1) {
          const targetPage = Math.floor(idx / PAGE_SIZE) + 1
          if (targetPage !== currentPage) setCurrentPage(targetPage)
        }
        setExpandedId(deepId)
        scrollCardIntoView(deepId)
      }
    } else {
      setDeepLinkMiss(true)
    }
    // Only on first load of this league feed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, filtered, currentPage])

  const saveStateAndGo = (id: number) => {
    if (!onDeepLink) return false
    try {
      const state: SavedFeedState = { y: window.scrollY, page: currentPage, query }
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(state))
    } catch {
      // Private mode: navigation still works, restore is skipped
    }
    onDeepLink(id)
    return true
  }

  const toggle = (id: number) => {
    // Desktop opens the routed story; mobile expands inline.
    if (isDesktopStory() && saveStateAndGo(id)) return
    setExpandedId(prev => {
      const next = prev === id ? null : id
      syncDeepLink(next)
      if (next !== null) scrollCardIntoView(next)
      return next
    })
  }

  const expandPick = (id: number) => {
    if (isDesktopStory() && saveStateAndGo(id)) return
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
              setCurrentPage(1)
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
          <SegmentedButton active={showFollowed} onClick={() => { setShowFollowed(v => !v); setCurrentPage(1) }}>
            {t('myMatches')}
          </SegmentedButton>
          <SegmentedButton active={showValue} onClick={() => { setShowValue(v => !v); setCurrentPage(1) }}>
            {t('valueOnly')}
          </SegmentedButton>
        </SegmentedGroup>
      </div>

      {deepLinkMiss && (
        <div role="alert" className="animate-fade mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-ink">
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
          <div className="flex flex-col gap-8">
            {groups.map(g => (
              <section key={g.date} aria-label={formatHumanDate(g.date, locale)}>
                <h3 className="sticky top-[112px] z-10 -mx-1 mb-3 flex items-baseline gap-2 border-y border-border bg-background/95 px-1 py-2 text-xs font-extrabold tracking-[0.08em] text-foreground uppercase backdrop-blur">
                  <span>{formatHumanDate(g.date, locale)}</span>
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 font-mono text-[11px] font-bold text-muted">
                    {g.items.length}
                  </span>
                </h3>
                <div className="flex flex-col gap-3">
                  {g.items.map(f => (
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
                      hideDate
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {filtered.length > PAGE_SIZE && (
            <nav aria-label="Paginación" className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-4">
              <p aria-live="polite" className="text-xs text-faint">
                {(() => {
                  const start = (currentPage - 1) * PAGE_SIZE + 1
                  const end = Math.min(currentPage * PAGE_SIZE, filtered.length)
                  return locale === 'es'
                    ? `Mostrando ${start}-${end} de ${filtered.length}`
                    : `Showing ${start}-${end} of ${filtered.length}`
                })()}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => {
                    const next = Math.max(1, currentPage - 1)
                    setCurrentPage(next)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  aria-label="Página anterior"
                  className="min-w-11"
                >
                  ←
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '…' ? (
                      <span key={`e-${idx}`} className="px-2 text-faint">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        type="button"
                        variant={p === currentPage ? 'primary' : 'secondary'}
                        aria-current={p === currentPage ? 'page' : undefined}
                        aria-label={`Página ${p} de ${totalPages}`}
                        onClick={() => {
                          setCurrentPage(p as number)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="min-w-11"
                      >
                        {p}
                      </Button>
                    ),
                  )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    const next = Math.min(totalPages, currentPage + 1)
                    setCurrentPage(next)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  aria-label="Página siguiente"
                  className="min-w-11"
                >
                  →
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

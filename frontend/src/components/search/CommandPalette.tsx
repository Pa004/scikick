import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { Fixture } from '../../types'
import { fetchFixtures } from '../../api'
import { useLanguage } from '../../i18n'
import { displayTeam, teamMatchesQuery } from '../../utils/teamNames'
import { matchesQuery } from '../fixtures/fixtureUtils'
import { fixtureVerdict } from '../fixtures/fixtureUtils'
import { TeamAvatar } from '../feed/TeamAvatar'
import { Input } from '../ui/input'
import { cn } from '../../lib/cn'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TeamEntry {
  name: string
  crest: string | null
}

interface MatchEntry {
  fixture: Fixture
  label: string
}

type ActiveItem = { kind: 'team'; entry: TeamEntry } | { kind: 'match'; entry: MatchEntry }

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)
  const cache = useRef<Fixture[] | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    if (cache.current) {
      setFixtures(cache.current)
      return
    }
    let live = true
    setFixtures(null)
    fetchFixtures('all', 200)
      .then(all => {
        if (!live) return
        cache.current = all
        setFixtures(all)
      })
      .catch(() => {
        if (live) setFixtures([])
      })
    return () => {
      live = false
    }
  }, [open ])

  const teams = useMemo<TeamEntry[]>(() => {
    const seen = new Map<string, string | null>()
    for (const f of fixtures ?? []) {
      if (!seen.has(f.home)) seen.set(f.home, f.home_crest ?? null)
      if (!seen.has(f.away)) seen.set(f.away, f.away_crest ?? null)
    }
    return [...seen.entries()]
      .filter(([name]) => teamMatchesQuery(name, query))
      .sort((a, b) => displayTeam(a[0]).localeCompare(displayTeam(b[0])))
      .slice(0, 6)
      .map(([name, crest]) => ({ name, crest }))
  }, [fixtures, query])

  const matches = useMemo<MatchEntry[]>(() => {
    if (query.trim() === '') return []
    return (fixtures ?? [])
      .filter(f => matchesQuery(f, query))
      .slice(0, 8)
      .map(f => {
        const v = fixtureVerdict(f)
        const verdict = v === null
          ? ''
          : v.outcome === 'draw'
            ? t('verdictDraw').replace('{n}', String(v.frequency))
            : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', String(v.frequency))
        return { fixture: f, label: verdict }
      })
  }, [fixtures, query, t])

  const items = useMemo<ActiveItem[]>(() => [
    ...teams.map((entry): ActiveItem => ({ kind: 'team', entry })),
    ...matches.map((entry): ActiveItem => ({ kind: 'match', entry })),
  ], [teams, matches])

  useEffect(() => {
    setActive(0)
  }, [query])

  const go = (item: ActiveItem) => {
    onOpenChange(false)
    if (item.kind === 'team') {
      navigate(`/equipo/${encodeURIComponent(item.entry.name)}`)
    } else {
      navigate(`/partido/${item.entry.fixture.id}`)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => (items.length === 0 ? 0 : (a + 1) % items.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => (items.length === 0 ? 0 : (a - 1 + items.length) % items.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[active]
      if (item) go(item)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-fade fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-label={t('searchCommand')}
          onKeyDown={onKeyDown}
          className="animate-pop fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-surface shadow-lg"
        >
          <DialogPrimitive.Title className="sr-only">{t('searchCommand')}</DialogPrimitive.Title>
          <div className="relative border-b border-border">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint"
            />
            <Input
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={items.length > 0 ? `command-item-${active}` : undefined}
              aria-label={t('searchCommand')}
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('searchFixtures')}
              className="border-0 bg-transparent pr-11 pl-11 text-base focus-visible:outline-none"
            />
            <DialogPrimitive.Close
              aria-label={t('dismiss')}
              className="absolute top-1/2 right-2 flex min-h-11 min-w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div id="command-results" role="listbox" aria-label={t('searchCommand')} className="max-h-[50vh] overflow-y-auto p-2">
            {fixtures === null ? (
              <p role="status" className="px-3 py-4 text-sm text-faint">{t('loading')}</p>
            ) : query.trim() === '' ? (
              <p className="px-3 py-4 text-sm text-faint">{t('searchHint')}</p>
            ) : items.length === 0 ? (
              <p role="status" className="px-3 py-4 text-sm text-faint">{t('searchNoResults')}</p>
            ) : (
              <>
                {teams.length > 0 && (
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-faint uppercase">
                    {t('searchTeams')}
                  </p>
                )}
                {teams.map((tm, i) => (
                  <CommandRow
                    key={`t-${tm.name}`}
                    id={`command-item-${i}`}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onSelect={() => go({ kind: 'team', entry: tm })}
                  >
                    <TeamAvatar team={tm.name} crest={tm.crest} />
                    <span className="truncate text-sm font-medium text-foreground">{displayTeam(tm.name)}</span>
                  </CommandRow>
                ))}
                {matches.length > 0 && (
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-faint uppercase">
                    {t('searchMatches')}
                  </p>
                )}
                {matches.map((m, i) => {
                  const idx = teams.length + i
                  return (
                    <CommandRow
                      key={`m-${m.fixture.id}`}
                      id={`command-item-${idx}`}
                      active={idx === active}
                      onHover={() => setActive(idx)}
                      onSelect={() => go({ kind: 'match', entry: m })}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {displayTeam(m.fixture.home)} vs {displayTeam(m.fixture.away)}
                        {m.label !== '' && (
                          <span className="ml-2 text-xs font-normal text-faint">{m.label}</span>
                        )}
                      </span>
                    </CommandRow>
                  )
                })}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CommandRow({
  id,
  active,
  onHover,
  onSelect,
  children,
}: {
  id: string
  active: boolean
  onHover: () => void
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left transition-colors',
        active ? 'bg-primary-soft' : 'bg-transparent',
      )}
    >
      {children}
    </button>
  )
}

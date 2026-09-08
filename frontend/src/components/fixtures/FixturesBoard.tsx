import { Search, X } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage } from '../../i18n'
import { extract1x2 } from '../../utils/matchCenter'
import { formatHumanDate, formatPct, fixtureVerdict } from './fixtureUtils'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../lib/cn'

const ODDS_SIDES = [
  { key: 'home', short: '1' },
  { key: 'draw', short: 'X' },
  { key: 'away', short: '2' },
] as const

function favoriteSide(f: Fixture): 'home' | 'draw' | 'away' | null {
  const probs = extract1x2(f.prediction)
  if (!probs) return null
  if (probs.home >= probs.draw && probs.home >= probs.away) return 'home'
  return probs.draw >= probs.away ? 'draw' : 'away'
}

interface FixtureRowProps {
  fixture: Fixture
  active: boolean
  leagueName: (code: string) => string
  onToggle: (id: number) => void
  onOddsClick: (id: number) => void
}

function FixtureRow({ fixture: f, active, leagueName, onToggle, onOddsClick }: FixtureRowProps) {
  const { t, locale } = useLanguage()
  const probs = extract1x2(f.prediction)
  const fav = favoriteSide(f)
  const sideLabel = (key: 'home' | 'draw' | 'away') =>
    key === 'home' ? t('home') : key === 'draw' ? t('draw') : t('away')

  return (
    <tr
      className={cn(
        'transition-colors hover:bg-surface-hover',
        active && 'bg-primary-soft hover:bg-primary-soft',
      )}
    >
      <td className="w-full p-0">
        <button
          type="button"
          onClick={() => onToggle(f.id)}
          aria-pressed={active}
          className="block w-full cursor-pointer rounded-l-lg px-3 py-2.5 text-left"
        >
          <span className="block text-xs text-faint">
            {formatHumanDate(f.date, locale)} · {leagueName(f.league)}
          </span>
          <span className="block font-medium text-foreground">
            {f.home} vs {f.away}
            {f.home_score !== null && (
              <span className="ml-2 text-muted tabular-nums">
                {f.home_score} - {f.away_score}
              </span>
            )}
          </span>
          <FixtureVerdict fixture={f} />
        </button>
      </td>
      {ODDS_SIDES.map(s => (
        <td key={s.key} className="p-0 text-center">
          <button
            type="button"
            disabled={!probs}
            onClick={() => onOddsClick(f.id)}
            aria-label={`${f.home} vs ${f.away} — ${sideLabel(s.key)}${probs ? ` ${formatPct(probs[s.key])}` : ''}${fav === s.key ? ` · ${t('favorite')}` : ''}`}
            title={probs ? undefined : t('oddsMissing')}
            className={cn(
              'min-h-11 w-full cursor-pointer px-2 font-mono text-sm text-foreground tabular-nums transition-colors',
              'hover:bg-primary-soft disabled:cursor-default disabled:opacity-45',
              fav === s.key && 'font-bold text-primary-strong',
            )}
          >
            {probs ? formatPct(probs[s.key]) : '—'}
          </button>
        </td>
      ))}
    </tr>
  )
}

function FixtureVerdict({ fixture: f }: { fixture: Fixture }) {
  const { t } = useLanguage()
  const v = fixtureVerdict(f)
  if (!v) return null
  const n = String(v.frequency)
  const text =
    v.outcome === 'draw'
      ? t('verdictDraw').replace('{n}', n)
      : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', n)
  return (
    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
      <span>{text}</span>
      {f.prediction != null && (
        <Badge variant="accent" className="text-[0.65rem]">
          {t('predicted')}
        </Badge>
      )}
    </span>
  )
}

interface FixtureTableProps {
  label: string
  fixtures: Fixture[]
  selectedId: number | null
  leagueName: (code: string) => string
  onToggle: (id: number) => void
  onOddsClick: (id: number) => void
}

function FixtureTable({ label, fixtures, selectedId, leagueName, onToggle, onOddsClick }: FixtureTableProps) {
  const { t } = useLanguage()
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-alt/60 text-xs font-semibold text-muted">
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {t('fixtures')}
            </th>
            <th scope="col" className="w-16 px-1 py-2 font-semibold">
              <span aria-hidden="true">1</span>
              <span className="sr-only">{t('home')}</span>
            </th>
            <th scope="col" className="w-16 px-1 py-2 font-semibold">
              <span aria-hidden="true">X</span>
              <span className="sr-only">{t('draw')}</span>
            </th>
            <th scope="col" className="w-16 px-1 py-2 font-semibold">
              <span aria-hidden="true">2</span>
              <span className="sr-only">{t('away')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child_td]:border-b-0">
          {fixtures.map(f => (
            <FixtureRow
              key={f.id}
              fixture={f}
              active={selectedId === f.id}
              leagueName={leagueName}
              onToggle={onToggle}
              onOddsClick={onOddsClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FixturesBoardProps {
  fixtures: Fixture[]
  featured: Fixture[]
  rest: Fixture[]
  showFeatured: boolean
  loading: boolean
  query: string
  onQueryChange: (q: string) => void
  selectedId: number | null
  leagueName: (code: string) => string
  onToggle: (id: number) => void
  onOddsClick: (id: number) => void
}

export function FixturesBoard({
  fixtures,
  featured,
  rest,
  showFeatured,
  loading,
  query,
  onQueryChange,
  selectedId,
  leagueName,
  onToggle,
  onOddsClick,
}: FixturesBoardProps) {
  const { t } = useLanguage()

  return (
    <section aria-labelledby="fixtures-heading">
      <h2 id="fixtures-heading" className="mb-3 font-display text-lg font-semibold text-foreground">
        {t('fixtures')}
      </h2>
      <div role="search" className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          />
          <Input
            type="search"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={t('searchFixtures')}
            aria-label={t('searchFixtures')}
            className="pl-9"
          />
        </div>
        {query && (
          <Button type="button" variant="secondary" onClick={() => onQueryChange('')}>
            <X aria-hidden="true" />
            {t('clearSearch')}
          </Button>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label={t('loading')} aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : fixtures.length === 0 ? (
        <p role="status" className="text-sm text-faint">
          {query.trim() ? t('noSearchResults') : t('noFixtures')}
        </p>
      ) : showFeatured ? (
        <div className="max-h-[600px] overflow-y-auto pb-1">
          <h3 className="mt-1 mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase">
            {t('featured')}
          </h3>
          <FixtureTable
            label={t('featured')}
            fixtures={featured}
            selectedId={selectedId}
            leagueName={leagueName}
            onToggle={onToggle}
            onOddsClick={onOddsClick}
          />
          <div className="mt-4">
            <FixtureTable
              label={t('fixtures')}
              fixtures={rest}
              selectedId={selectedId}
              leagueName={leagueName}
              onToggle={onToggle}
              onOddsClick={onOddsClick}
            />
          </div>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pb-1">
          <FixtureTable
            label={t('fixtures')}
            fixtures={fixtures}
            selectedId={selectedId}
            leagueName={leagueName}
            onToggle={onToggle}
            onOddsClick={onOddsClick}
          />
        </div>
      )}
    </section>
  )
}

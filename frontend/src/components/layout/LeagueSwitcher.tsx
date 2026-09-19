import { useLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

export interface LeagueOption {
  code: string
  labelKey:
    | 'allLeagues'
    | 'premierLeague'
    | 'laLiga'
    | 'bundesliga'
    | 'serieA'
    | 'ligue1'
    | 'ligaPro'
}

export const LEAGUES: LeagueOption[] = [
  { code: '', labelKey: 'allLeagues' },
  { code: 'E0', labelKey: 'premierLeague' },
  { code: 'SP1', labelKey: 'laLiga' },
  { code: 'D1', labelKey: 'bundesliga' },
  { code: 'I1', labelKey: 'serieA' },
  { code: 'F1', labelKey: 'ligue1' },
  { code: 'EC1', labelKey: 'ligaPro' },
]

interface LeagueSwitcherProps {
  league: string
  onChange: (code: string) => void
  compact?: boolean
  counts?: Record<string, number>
}

export function LeagueSwitcher({ league, onChange, compact = false, counts }: LeagueSwitcherProps) {
  const { t } = useLanguage()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id="league-switcher-label" className={compact ? 'sr-only' : 'text-xs font-bold tracking-[0.08em] text-faint uppercase'}>
        {t('league')}
      </span>
      <div
        role="group"
        aria-labelledby="league-switcher-label"
        className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {LEAGUES.map(l => {
          const active = league === l.code
          const count = counts?.[l.code]
          const showDot = l.code === 'SP1' && (count ?? 0) > 0
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(l.code)}
              className={cn(
                'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors duration-150',
                active
                  ? 'border-primary/20 bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {showDot && <span aria-hidden="true" className="size-2 rounded-full bg-primary" />}
              {t(l.labelKey)}
              {count !== undefined && (
                <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-xs', active ? 'bg-surface text-muted' : 'bg-surface-alt text-muted')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

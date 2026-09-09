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
}

export const LEAGUES: LeagueOption[] = [
  { code: '', labelKey: 'allLeagues' },
  { code: 'E0', labelKey: 'premierLeague' },
  { code: 'SP1', labelKey: 'laLiga' },
  { code: 'D1', labelKey: 'bundesliga' },
  { code: 'I1', labelKey: 'serieA' },
  { code: 'F1', labelKey: 'ligue1' },
]

interface LeagueSwitcherProps {
  league: string
  onChange: (code: string) => void
}

export function LeagueSwitcher({ league, onChange }: LeagueSwitcherProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-2">
      <span id="league-switcher-label" className="text-xs font-medium text-faint">
        {t('league')}
      </span>
      <div
        role="group"
        aria-labelledby="league-switcher-label"
        className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface-alt p-1"
      >
        {LEAGUES.map(l => {
          const active = league === l.code
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(l.code)}
              className={cn(
                'min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
                active
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {t(l.labelKey)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

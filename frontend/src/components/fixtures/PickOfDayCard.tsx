import { Trophy } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { formatFrequency } from '../../utils/verdict'
import type { DayPick } from '../../utils/matchCenter'
import { Badge } from '../ui/badge'

interface PickOfDayCardProps {
  pick: DayPick | null
  leagueName: (code: string) => string
  onSelect: (fixtureId: number) => void
}

export function PickOfDayCard({ pick, leagueName, onSelect }: PickOfDayCardProps) {
  const { t } = useLanguage()
  if (!pick) {
    return <p className="mb-4 text-sm text-faint">{t('pickOfDayEmpty')}</p>
  }
  const label = pick.outcome === 'home' ? t('home') : pick.outcome === 'draw' ? t('draw') : t('away')
  const league = leagueName(pick.league)
  const freq = t('frequencyInTen').replace('{n}', String(formatFrequency(pick.prob)))
  return (
    <button
      type="button"
      onClick={() => onSelect(pick.fixtureId)}
      aria-label={`${t('pickOfDay')}: ${pick.home} vs ${pick.away}, ${league}, ${label} ${(pick.prob * 100).toFixed(1)}%, ${freq}`}
      className="animate-rise mb-4 w-full cursor-pointer rounded-xl border border-primary/30 bg-primary-soft p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-primary-strong uppercase">
        <Trophy aria-hidden="true" className="size-3.5" />
        {t('pickOfDay')}
      </span>
      <span className="block font-semibold text-foreground">
        {pick.home} vs {pick.away}
        <span className="font-normal text-muted"> · {league}</span>
      </span>
      <Badge variant="accent" className="mt-2">
        {label} {(pick.prob * 100).toFixed(1)}% · {freq}
      </Badge>
    </button>
  )
}

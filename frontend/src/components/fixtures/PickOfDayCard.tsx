import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { formatFrequency } from '../../utils/verdict'
import { displayTeam } from '../../utils/teamNames'
import type { DayPick } from '../../utils/matchCenter'
import { Badge } from '../ui/badge'

const DISMISS_KEY = 'scikick.pick-dismissed'
const ANIMATED_KEY = 'scikick.pick-animated'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey()
  } catch {
    return false
  }
}

interface PickOfDayCardProps {
  pick: DayPick | null
  leagueName: (code: string) => string
  onSelect: (fixtureId: number) => void
}

export function PickOfDayCard({ pick, leagueName, onSelect }: PickOfDayCardProps) {
  const { t } = useLanguage()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ANIMATED_KEY) == null) {
        sessionStorage.setItem(ANIMATED_KEY, '1')
        setAnimate(true)
      }
    } catch {
      setAnimate(true)
    }
  }, [])
  if (!pick || dismissed) {
    return !pick ? <p className="mb-4 text-sm text-faint">{t('pickOfDayEmpty')}</p> : null
  }
  const label = pick.outcome === 'home' ? t('home') : pick.outcome === 'draw' ? t('draw') : t('away')
  const league = leagueName(pick.league)
  const freq = t('frequencyInTen').replace('{n}', String(formatFrequency(pick.prob)))
  const homeLabel = displayTeam(pick.home)
  const awayLabel = displayTeam(pick.away)
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, todayKey())
    } catch {
      // Private mode: dismissal lasts for the session
    }
  }
  return (
    <div
      className={`${animate ? 'animate-rise ' : ''}mb-4 w-full rounded-xl border border-primary/30 bg-primary-soft p-4 shadow-md`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onSelect(pick.fixtureId)}
          aria-label={`${t('pickOfDay')}: ${homeLabel} vs ${awayLabel}, ${league}, ${label} ${(pick.prob * 100).toFixed(1)}%, ${freq}`}
          className="min-w-0 flex-1 cursor-pointer rounded-md text-left"
        >
          <span className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-primary-ink uppercase">
            <Trophy aria-hidden="true" className="size-3.5" />
            {t('pickOfDay')}
          </span>
          <span className="block text-lg font-semibold text-foreground">
            {homeLabel} vs {awayLabel}
            <span className="font-normal text-muted"> · {league}</span>
          </span>
          <Badge variant="accent" className="mt-2 max-w-full truncate">
            {label} {(pick.prob * 100).toFixed(1)}% · {freq}
          </Badge>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismissPick')}
          title={t('dismissPick')}
          className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  )
}

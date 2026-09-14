import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { formatFrequency } from '../../utils/verdict'
import { displayTeam } from '../../utils/teamNames'
import type { DayPick } from '../../utils/matchCenter'

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
      className={`${animate ? 'animate-rise ' : ''}mb-[18px] w-full rounded-[14px] border border-border bg-surface p-4`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-extrabold tracking-[0.08em] text-primary-ink uppercase">
            <Trophy aria-hidden="true" className="size-3.5" />
            {t('pickOfDay')}
          </p>
          <p className="mt-2.5 text-[19px] leading-snug font-bold text-foreground sm:text-[22px]">
            {homeLabel} vs {awayLabel}
          </p>
          <p className="mt-1 max-w-[65ch] text-[15px] text-muted">
            {label} {(pick.prob * 100).toFixed(1)}% · {freq} · {league}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onSelect(pick.fixtureId)}
              aria-label={`${t('pickOfDay')}: ${homeLabel} vs ${awayLabel}, ${league}, ${label} ${(pick.prob * 100).toFixed(1)}%, ${freq}`}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent bg-primary px-[18px] text-[15px] font-bold text-primary-fg transition-[filter] duration-150 hover:brightness-110"
            >
              {t('seeWhy')}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-[18px] text-[15px] font-bold text-foreground transition-colors hover:bg-surface-hover"
            >
              {t('dismissPick')}
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

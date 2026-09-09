import type { OutcomeProbs } from '../../utils/matchCenter'
import { displayTeam } from '../../utils/teamNames'
import { useLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

interface SegmentedBarProps {
  probs: OutcomeProbs
  home: string
  away: string
  onSelect: () => void
}

// The 1X2 grid condensed into one glanceable bar. Segments are buttons:
// activating one opens the story on the 1X2 market. Widths carry the
// information; the text legend (not color alone) names each share.
export function SegmentedBar({ probs, home, away, onSelect }: SegmentedBarProps) {
  const { t } = useLanguage()
  const homeLabel = displayTeam(home)
  const awayLabel = displayTeam(away)
  const total = probs.home + probs.draw + probs.away || 1
  const segments = [
    { key: 'home', label: `1 · ${homeLabel}`, pct: (probs.home / total) * 100, className: 'bg-primary' },
    { key: 'draw', label: `X · ${t('draw')}`, pct: (probs.draw / total) * 100, className: 'bg-faint/50' },
    { key: 'away', label: `2 · ${awayLabel}`, pct: (probs.away / total) * 100, className: 'bg-primary-strong' },
  ] as const

  return (
    <span className="block">
      <span className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="presentation">
        {segments.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={e => {
              e.stopPropagation()
              onSelect()
            }}
            aria-label={`${s.label}: ${s.pct.toFixed(1)}%`}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
            style={{ width: `${s.pct}%` }}
            className={cn('h-full min-w-2 cursor-pointer rounded-full transition-transform duration-150 hover:scale-y-125', s.className)}
          />
        ))}
      </span>
      <span className="mt-1 flex justify-between text-[0.7rem] font-medium text-muted tabular-nums">
        <span>1 · {(probs.home * 100).toFixed(0)}%</span>
        <span>X · {(probs.draw * 100).toFixed(0)}%</span>
        <span>2 · {(probs.away * 100).toFixed(0)}%</span>
      </span>
    </span>
  )
}

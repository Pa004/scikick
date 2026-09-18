import type { OutcomeProbs } from '../../utils/matchCenter'
import { displayTeam } from '../../utils/teamNames'
import { useLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

interface SegmentedBarProps {
  probs: OutcomeProbs
  home: string
  away: string
  onSelect: () => void
  compact?: boolean
}

// The 1X2 grid condensed into one glanceable bar. Segments are buttons:
// activating one opens the story on the 1X2 market. Widths carry the
// information; the text legend (not color alone) names each share.
// Semantic fills: home = primary, draw = tinted surface + border,
// away = danger (loss). Value stays badge-only, never a bar solid.
export function SegmentedBar({ probs, home, away, onSelect, compact = false }: SegmentedBarProps) {
  const { t } = useLanguage()
  const homeLabel = displayTeam(home)
  const awayLabel = displayTeam(away)
  const total = probs.home + probs.draw + probs.away || 1
  const segments = [
    { key: 'home', label: `1 · ${homeLabel}`, short: '1', pct: (probs.home / total) * 100, className: 'bg-primary' },
    { key: 'draw', label: `X · ${t('draw')}`, short: 'X', pct: (probs.draw / total) * 100, className: 'border border-border bg-surface-alt' },
    { key: 'away', label: `2 · ${awayLabel}`, short: '2', pct: (probs.away / total) * 100, className: 'bg-danger' },
  ] as const

  return (
    <span className="block">
      <span className={cn('flex w-full gap-0.5 overflow-hidden rounded-full border border-border', compact ? 'h-2' : 'h-[22px]')}>
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
            className={cn('relative h-full min-w-2 cursor-pointer transition-transform duration-150 hover:brightness-110', 'after:absolute after:inset-x-0 after:-inset-y-3 after:content-[""]', 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring', s.className)}
          />
        ))}
      </span>
      {!compact && (
        <>
          <ul className="mt-3 grid list-none gap-2 p-0">
            {segments.map(s => (
              <li key={s.key} className="flex items-center gap-2.5 text-[15px] text-foreground">
                <span aria-hidden="true" className={cn('size-3.5 flex-none rounded border border-border', s.key === 'home' ? 'bg-primary' : s.key === 'draw' ? 'bg-surface-alt' : 'bg-danger')} />
                <span>{s.label} <strong className="font-mono tabular-nums">{s.pct.toFixed(0)}%</strong></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-xs text-faint">{t('oneXTwoLegend')}</p>
        </>
      )}
    </span>
  )
}

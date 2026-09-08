import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useLanguage } from '../i18n'
import { formatDecimal } from '../utils/odds'
import { getOutcomeLabel } from '../utils/marketLabels'
import type { DisplayMode } from '../hooks/useDisplayMode'
import type { MoveDirection } from '../hooks/useMovement'
import { useChartTheme } from './charts/chartTheme'
import { cn } from '../lib/cn'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

function MoveArrow({ move }: { move: MoveDirection }) {
  const { t } = useLanguage()
  if (move === 'flat') return null
  const up = move === 'up'
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      role="img"
      aria-label={up ? t('oddsUp') : t('oddsDown')}
      className={cn('ml-1.5 inline-flex align-middle', up ? 'text-success' : 'text-danger')}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </span>
  )
}

function ProbBar({ label, prob, mode, move }: { label: string; prob: number; mode: DisplayMode; move: MoveDirection }) {
  const { t } = useLanguage()
  const isFavorite = prob > 0.5
  return (
    <div
      className={cn(
        'relative flex min-h-11 items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-surface px-3.5 py-2 text-sm transition-colors duration-150 hover:border-primary/40',
        isFavorite && 'border-primary/50',
      )}
    >
      <div className="prob-bar-fill absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-500" style={{ width: `${prob * 100}%` }} />
      <span className="relative z-10 font-medium text-foreground">
        {label}
        {isFavorite && <span className="sr-only"> · {t('favorite')}</span>}
      </span>
      <span className={cn('relative z-10 tabular-nums', isFavorite ? 'font-semibold text-primary-strong' : 'text-muted')}>
        {mode === 'odds' ? formatDecimal(prob) : formatProb(prob)}
        <MoveArrow move={move} />
      </span>
    </div>
  )
}

interface InnerProps {
  market: string
  data: Record<string, number>
  mode: DisplayMode
  moves: Record<string, MoveDirection>
}

function isNestedGroups(data: Record<string, number>): boolean {
  const first = Object.values(data)[0]
  return typeof first === 'object' && first !== null
}

function MarketRendererInner({ market, data, mode, moves }: InnerProps) {
  const { t, locale } = useLanguage()
  const chart = useChartTheme()
  const bar = (key: string, prob: number, label?: string) => (
    <ProbBar label={label ?? getOutcomeLabel(market, key, locale)} prob={prob} mode={mode} move={moves[key] ?? 'flat'} />
  )

  const threeWay = () => (
    <div className="flex flex-col gap-1.5">
      {data.home !== undefined && bar('home', data.home)}
      {data.draw !== undefined && bar('draw', data.draw)}
      {data.away !== undefined && bar('away', data.away)}
    </div>
  )

  const overUnder = () => {
    const sides = (['over', 'under'] as const).filter(k => data[k] !== undefined)
    if (sides.length === 0) {
      return <span className="text-sm text-faint">{t('marketMissing')}</span>
    }
    return (
      <div className="flex flex-col gap-1.5">
        {sides.map(k => bar(k, data[k]))}
      </div>
    )
  }

  const entries = () => (
    <div className="flex flex-col gap-1.5">
      {Object.entries(data).map(([k, v]) => (
        <ProbBar key={k} label={getOutcomeLabel(market, k, locale)} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
      ))}
    </div>
  )

  const exactScore = () => {
    const sorted = Object.entries(data)
      .filter(([k]) => k !== 'other')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const otherProb = data.other ?? 0
    return (
      <div className="flex flex-col gap-1.5">
        {sorted.map(([k, v]) => (
          <ProbBar key={k} label={getOutcomeLabel(market, k, locale)} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
        ))}
        {otherProb > 0 && bar('other', otherProb)}
      </div>
    )
  }

  const htGroups = (nested: Record<string, Record<string, number>>) => (
    <div className="flex flex-col gap-3">
      {Object.entries(nested).map(([k, group]) => (
        <div key={k}>
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {getOutcomeLabel(market, k, locale)}
          </div>
          <div className="flex flex-col gap-1.5">
            {['home', 'draw', 'away']
              .filter(o => typeof group[o] === 'number')
              .map(o => (
                <ProbBar
                  key={o}
                  label={getOutcomeLabel('1x2', o, locale)}
                  prob={group[o]}
                  mode={mode}
                  move={moves[`${k}.${o}`] ?? 'flat'}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )

  const totalGoals = () => {
    const rank = (k: string) => (k.endsWith('+') ? 999 : Number.parseInt(k, 10))
    const chartData = Object.entries(data)
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([k, v]) => ({ goals: k, probability: +(v * 100).toFixed(1) }))
    const summary = `${getOutcomeLabel(market, 'total', locale)}: ${chartData.map(d => `${d.goals} ${d.probability}%`).join(', ')}`
    return (
      <div className="h-44">
        <div role="img" aria-label={summary} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="goals" fontSize={12} stroke={chart.grid} tick={{ fill: chart.tick }} />
            <YAxis fontSize={12} stroke={chart.grid} tick={{ fill: chart.tick }} />
            <Tooltip
              contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px', color: chart.tooltipText }}
              formatter={(value) => `${value}%`}
            />
            <Bar dataKey="probability" fill={chart.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{summary}</caption>
          <tbody>
            {chartData.map(row => (
              <tr key={row.goals}>
                <td>{row.goals}</td>
                <td>{row.probability}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const combined = () => (
    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
          <div className="mb-1 text-muted">{getOutcomeLabel(market, k, locale)}</div>
          <div className="font-semibold text-foreground tabular-nums">
            {mode === 'odds' ? formatDecimal(v) : formatProb(v)}
            <MoveArrow move={moves[k] ?? 'flat'} />
          </div>
        </div>
      ))}
    </div>
  )

  const fallback = () => (
    <pre className="overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs text-muted">
      {JSON.stringify(data, null, 2)}
    </pre>
  )

  const isCorners = market.startsWith('corners_')
  const isCards = market.startsWith('cards_')

  if (market === 'ft_result_given_ht') {
    if (!isNestedGroups(data)) return fallback()
    return htGroups(data as unknown as Record<string, Record<string, number>>)
  }

  if (['1x2', 'draw_no_bet', 'double_chance', 'win_to_nil', 'ht_1x2', 'ht_double_chance'].includes(market)) {
    return threeWay()
  }

  if (market.startsWith('over_under_') && !isCorners && !isCards) {
    return overUnder()
  }

  if (market === 'btts' || market === 'odd_even') {
    return entries()
  }

  if (market.startsWith('handicap_') || market.startsWith('asian_handicap_')) {
    return threeWay()
  }

  if (market === 'clean_sheet') return entries()
  if (market === 'goal_bands') return entries()
  if (market === 'exact_score') return exactScore()
  if (market === 'total_goals') return totalGoals()
  if (market === 'both_halves') return entries()
  if (market === 'highest_scoring_half') return entries()

  if (isCorners || isCards) {
    if (market.includes('over_under_')) return overUnder()
    if (market.includes('handicap_')) return threeWay()
    if (market.includes('total')) return totalGoals()
    return fallback()
  }

  if (['home_o25', 'away_btts', 'draw_u25', 'home_btts', 'dc_o25', 'dc_u25', '1x2_btts'].includes(market)) {
    return combined()
  }

  return fallback()
}

interface MarketRendererProps {
  market: string
  probabilities: Record<string, Record<string, number>>
  mode?: DisplayMode
  moves?: Record<string, MoveDirection>
}

export default function MarketRenderer({ market, probabilities, mode = 'prob', moves = {} }: MarketRendererProps) {
  const { t } = useLanguage()
  const data = probabilities[market]
  if (!data) return <span className="text-sm text-faint">{t('marketMissing')}</span>
  return <MarketRendererInner market={market} data={data} mode={mode} moves={moves} />
}

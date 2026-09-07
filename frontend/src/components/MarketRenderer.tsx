import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useLanguage } from '../i18n'
import { formatDecimal } from '../utils/odds'
import { getOutcomeLabel } from '../utils/marketLabels'
import type { DisplayMode } from '../hooks/useDisplayMode'
import type { MoveDirection } from '../hooks/useMovement'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

function MoveArrow({ move }: { move: MoveDirection }) {
  const { t } = useLanguage()
  if (move === 'flat') return null
  const up = move === 'up'
  return (
    <span
      role="img"
      aria-label={up ? t('oddsUp') : t('oddsDown')}
      className={`move-flash ${up ? 'move-up' : 'move-down'}`}
      style={{ fontSize: '0.75rem', marginLeft: '0.375rem' }}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
    </span>
  )
}

function ProbBar({ label, prob, mode, move }: { label: string; prob: number; mode: DisplayMode; move: MoveDirection }) {
  const isFavorite = prob > 0.5
  return (
    <div
      className={`prob-bar ${isFavorite ? 'prob-bar-favorite' : ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div className="prob-bar-fill" style={{ width: `${prob * 100}%` }} />
      <span style={{ fontWeight: 500, position: 'relative', zIndex: 1 }}>{label}</span>
      <span style={{ color: isFavorite ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isFavorite ? 600 : 400, position: 'relative', zIndex: 1 }}>
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
  const bar = (key: string, prob: number, label?: string) => (
    <ProbBar label={label ?? getOutcomeLabel(market, key, locale)} prob={prob} mode={mode} move={moves[key] ?? 'flat'} />
  )

  const threeWay = () => (
    <div>
      {data.home !== undefined && bar('home', data.home)}
      {data.draw !== undefined && bar('draw', data.draw)}
      {data.away !== undefined && bar('away', data.away)}
    </div>
  )

  const overUnder = () => {
    if (data.over === undefined && data.under === undefined) {
      return <span style={{ color: 'var(--text-muted)' }}>{t('marketMissing')}</span>
    }
    return (
      <div>
        {bar('over', data.over ?? 0)}
        {bar('under', data.under ?? 0)}
      </div>
    )
  }

  const entries = () => (
    <div>
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
      <div>
        {sorted.map(([k, v]) => (
          <ProbBar key={k} label={getOutcomeLabel(market, k, locale)} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
        ))}
        {otherProb > 0 && bar('other', otherProb)}
      </div>
    )
  }

  const htGroups = (nested: Record<string, Record<string, number>>) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Object.entries(nested).map(([k, group]) => (
        <div key={k}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {getOutcomeLabel(market, k, locale)}
          </div>
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
      ))}
    </div>
  )

  const totalGoals = () => {
    const rank = (k: string) => (k.endsWith('+') ? 999 : Number.parseInt(k, 10))
    const chartData = Object.entries(data)
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([k, v]) => ({ goals: k, probability: +(v * 100).toFixed(1) }))
    return (
      <div style={{ height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="goals" fontSize={12} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={12} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ background: '#1a2238', border: '1px solid #2a3350', borderRadius: '8px', color: '#e2e8f0' }}
              formatter={(value) => `${value}%`}
            />
            <Bar dataKey="probability" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const combined = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="card-flat" style={{ padding: '0.625rem', fontSize: '0.85rem' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{getOutcomeLabel(market, k, locale)}</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {mode === 'odds' ? formatDecimal(v) : formatProb(v)}
            <MoveArrow move={moves[k] ?? 'flat'} />
          </div>
        </div>
      ))}
    </div>
  )

  const fallback = () => (
    <pre className="card-flat" style={{ fontSize: '0.75rem', padding: '0.75rem', overflow: 'auto' }}>
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
  if (!data) return <span style={{ color: 'var(--text-muted)' }}>{t('marketMissing')}</span>
  return <MarketRendererInner market={market} data={data} mode={mode} moves={moves} />
}

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useLanguage } from '../i18n'
import { formatDecimal } from '../utils/odds'
import type { DisplayMode } from '../hooks/useDisplayMode'
import type { MoveDirection } from '../hooks/useMovement'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

function MoveArrow({ move }: { move: MoveDirection }) {
  const { t } = useLanguage()
  if (move === 'flat') return null
  const up = move === 'up'
  return (
    <span
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

function MarketRendererInner({ market, data, mode, moves }: InnerProps) {
  const { t } = useLanguage()
  const bar = (key: string, label: string, prob: number) => (
    <ProbBar label={label} prob={prob} mode={mode} move={moves[key] ?? 'flat'} />
  )

  const threeWay = (labels: { home: string; draw: string; away: string }) => (
    <div>
      {data.home !== undefined && bar('home', labels.home, data.home)}
      {data.draw !== undefined && bar('draw', labels.draw, data.draw)}
      {data.away !== undefined && bar('away', labels.away, data.away)}
    </div>
  )

  const overUnder = () => (
    <div>
      {bar('over', t('over'), data.over ?? 0)}
      {bar('under', t('under'), data.under ?? 0)}
    </div>
  )

  const twoWay = (labels: { [key: string]: string }) => (
    <div>
      {Object.keys(data).map(k => (
        <ProbBar key={k} label={labels[k] ?? k} prob={data[k]} mode={mode} move={moves[k] ?? 'flat'} />
      ))}
    </div>
  )

  const cleanSheet = () => (
    <div>
      {bar('home_yes', 'Home CS Yes', data.home_yes ?? 0)}
      {bar('home_no', 'Home CS No', data.home_no ?? 0)}
      {bar('away_yes', 'Away CS Yes', data.away_yes ?? 0)}
      {bar('away_no', 'Away CS No', data.away_no ?? 0)}
    </div>
  )

  const goalBands = () => {
    const labels: { [key: string]: string } = { '0': '0 goals', '1-2': '1-2 goals', '3-4': '3-4 goals', '5+': '5+ goals' }
    return (
      <div>
        {Object.entries(data).map(([k, v]) => (
          <ProbBar key={k} label={labels[k] ?? k} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
        ))}
      </div>
    )
  }

  const exactScore = () => {
    const sorted = Object.entries(data)
      .filter(([k]) => k !== 'other')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const otherProb = data.other ?? 0
    return (
      <div>
        {sorted.map(([k, v]) => (
          <ProbBar key={k} label={k} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
        ))}
        {otherProb > 0 && bar('other', t('other'), otherProb)}
      </div>
    )
  }

  const totalGoals = () => {
    const chartData = Object.entries(data).map(([k, v]) => ({ goals: k, probability: +(v * 100).toFixed(1) }))
    return (
      <div style={{ height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <XAxis dataKey="goals" fontSize={12} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={12} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ background: '#1a2238', border: '1px solid #2a3350', borderRadius: '8px', color: '#e2e8f0' }}
              formatter={(value) => `${value}%`}
            />
            <Bar dataKey="probability" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const bothHalves = () => {
    const labels: { [key: string]: string } = {
      'team_wins_both_halves': 'Team Wins Both',
      'team_wins_either_half': 'Team Wins Either',
      'draw_both_halves': 'Draw Both Halves',
      'both_teams_score_both_halves': 'BTTS Both Halves',
      'ht_over_0.5_ft_over_0.5': 'HT O0.5 + FT O0.5',
      'ht_over_1.5_ft_over_1.5': 'HT O1.5 + FT O1.5',
      'ht_over_2.5_ft_over_2.5': 'HT O2.5 + FT O2.5',
    }
    return (
      <div>
        {Object.entries(data).map(([k, v]) => (
          <ProbBar key={k} label={labels[k] ?? k} prob={v} mode={mode} move={moves[k] ?? 'flat'} />
        ))}
      </div>
    )
  }

  const combined = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="card-flat" style={{ padding: '0.625rem', fontSize: '0.85rem' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{k.replace(/_/g, ' ')}</div>
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

  if (['1x2', 'draw_no_bet', 'double_chance', 'win_to_nil', 'ht_1x2', 'ht_double_chance'].includes(market)) {
    return threeWay({ home: t('home'), draw: t('draw'), away: t('away') })
  }

  if (market.startsWith('over_under_') && !isCorners && !isCards) {
    return overUnder()
  }

  if (market === 'btts' || market === 'odd_even') {
    const bttsLabels: { [key: string]: string } = { yes: 'Yes (BTTS)', no: 'No' }
    const oddEvenLabels: { [key: string]: string } = { odd: 'Odd', even: 'Even' }
    return twoWay(market === 'btts' ? bttsLabels : oddEvenLabels)
  }

  if (market.startsWith('handicap_') || market.startsWith('asian_handicap_')) {
    return threeWay({ home: t('home'), draw: t('draw'), away: t('away') })
  }

  if (market === 'clean_sheet') return cleanSheet()
  if (market === 'goal_bands') return goalBands()
  if (market === 'exact_score') return exactScore()
  if (market === 'total_goals') return totalGoals()
  if (market === 'both_halves') return bothHalves()
  if (market === 'ft_result_given_ht') return fallback()

  if (isCorners || isCards) {
    if (market.includes('over_under_')) return overUnder()
    if (market.includes('handicap_')) return threeWay({ home: t('home'), draw: t('draw'), away: t('away') })
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
  const data = probabilities[market]
  if (!data) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>
  return <MarketRendererInner market={market} data={data} mode={mode} moves={moves} />
}

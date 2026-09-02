import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

const barStyle = (prob: number): React.CSSProperties => ({
  background: `linear-gradient(90deg, #3b82f6 ${prob * 100}%, #f0f4ff ${prob * 100}%)`,
  borderRadius: '4px',
  padding: '0.5rem 0.75rem',
  marginBottom: '0.25rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.9rem',
})

function ProbBar({ label, prob }: { label: string; prob: number }) {
  return (
    <div style={barStyle(prob)}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color: prob > 0.5 ? '#1a1a2e' : '#666' }}>{formatProb(prob)}</span>
    </div>
  )
}

function ThreeWay({ data }: { data: Record<string, number> }) {
  return (
    <div>
      {data.home !== undefined && <ProbBar label="Home" prob={data.home} />}
      {data.draw !== undefined && <ProbBar label="Draw" prob={data.draw} />}
      {data.away !== undefined && <ProbBar label="Away" prob={data.away} />}
    </div>
  )
}

function OverUnder({ data }: { data: Record<string, number> }) {
  return (
    <div>
      <ProbBar label="Over" prob={data.over ?? 0} />
      <ProbBar label="Under" prob={data.under ?? 0} />
    </div>
  )
}

function TwoWay({ data, labels }: { data: Record<string, number>; labels?: { [key: string]: string } }) {
  const keys = Object.keys(data)
  return (
    <div>
      {keys.map(k => (
        <ProbBar key={k} label={labels?.[k] ?? k} prob={data[k]} />
      ))}
    </div>
  )
}

function CleanSheet({ data }: { data: Record<string, number> }) {
  return (
    <div>
      <ProbBar label="Home CS Yes" prob={data.home_yes ?? 0} />
      <ProbBar label="Home CS No" prob={data.home_no ?? 0} />
      <ProbBar label="Away CS Yes" prob={data.away_yes ?? 0} />
      <ProbBar label="Away CS No" prob={data.away_no ?? 0} />
    </div>
  )
}

function GoalBands({ data }: { data: Record<string, number> }) {
  const labels: { [key: string]: string } = { '0': '0 goals', '1-2': '1-2 goals', '3-4': '3-4 goals', '5+': '5+ goals' }
  return (
    <div>
      {Object.entries(data).map(([k, v]) => (
        <ProbBar key={k} label={labels[k] ?? k} prob={v} />
      ))}
    </div>
  )
}

function ExactScore({ data }: { data: Record<string, number> }) {
  const sorted = Object.entries(data)
    .filter(([k]) => k !== 'other')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const otherProb = data.other ?? 0
  return (
    <div>
      {sorted.map(([k, v]) => (
        <ProbBar key={k} label={k} prob={v} />
      ))}
      {otherProb > 0 && <ProbBar label="Other" prob={otherProb} />}
    </div>
  )
}

function TotalGoals({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([k, v]) => ({ goals: k, probability: +(v * 100).toFixed(1) }))
  return (
    <div style={{ height: '150px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="goals" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Bar dataKey="probability" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BothHalves({ data }: { data: Record<string, number> }) {
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
        <ProbBar key={k} label={labels[k] ?? k} prob={v} />
      ))}
    </div>
  )
}

function Combined({ data }: { data: Record<string, number> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ background: '#f9f9f9', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
          <div style={{ color: '#666', marginBottom: '0.25rem' }}>{k.replace(/_/g, ' ')}</div>
          <div style={{ fontWeight: 600 }}>{formatProb(v)}</div>
        </div>
      ))}
    </div>
  )
}

function Fallback({ data }: { data: Record<string, unknown> }) {
  return <pre style={{ fontSize: '0.75rem', background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px', overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>
}

export default function MarketRenderer({ market, probabilities }: { market: string; probabilities: Record<string, Record<string, number>> }) {
  const data = probabilities[market]
  if (!data) return <span style={{ color: '#999' }}>N/A</span>

  const isCorners = market.startsWith('corners_')
  const isCards = market.startsWith('cards_')

  if (market === '1x2' || market === 'draw_no_bet' || market === 'double_chance' || market === 'win_to_nil') {
    return <ThreeWay data={data} />
  }

  if (market === 'ht_1x2' || market === 'ht_double_chance') {
    return <ThreeWay data={data} />
  }

  if (market.startsWith('over_under_') && !isCorners && !isCards) {
    return <OverUnder data={data} />
  }

  if (market === 'btts' || market === 'odd_even') {
    const bttsLabels: { [key: string]: string } = { yes: 'Yes (BTTS)', no: 'No' }
    const oddEvenLabels: { [key: string]: string } = { odd: 'Odd', even: 'Even' }
    return <TwoWay data={data} labels={market === 'btts' ? bttsLabels : oddEvenLabels} />
  }

  if (market.startsWith('handicap_') || market.startsWith('asian_handicap_')) {
    return <ThreeWay data={data} />
  }

  if (market === 'clean_sheet') {
    return <CleanSheet data={data} />
  }

  if (market === 'goal_bands') {
    return <GoalBands data={data} />
  }

  if (market === 'exact_score') {
    return <ExactScore data={data} />
  }

  if (market === 'total_goals') {
    return <TotalGoals data={data} />
  }

  if (market === 'both_halves') {
    return <BothHalves data={data} />
  }

  if (market === 'ft_result_given_ht') {
    return <Fallback data={data} />
  }

  if (isCorners || isCards) {
    if (market.includes('over_under_')) return <OverUnder data={data} />
    if (market.includes('handicap_')) return <ThreeWay data={data} />
    if (market.includes('total')) return <TotalGoals data={data} />
    return <Fallback data={data} />
  }

  if (['home_o25', 'away_btts', 'draw_u25', 'home_btts', 'dc_o25', 'dc_u25', '1x2_btts'].includes(market)) {
    return <Combined data={data} />
  }

  return <Fallback data={data} />
}

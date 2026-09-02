import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { MatchdayStats } from '../types'

interface MatchdayChartProps {
  data: MatchdayStats[]
}

export default function MatchdayChart({ data }: MatchdayChartProps) {
  if (data.length === 0) {
    return <p style={{ color: '#999' }}>No matchday data available.</p>
  }

  const chartData = data.map(d => ({
    date: d.matchday.slice(5),
    brier: +d.brier.toFixed(3),
    accuracy: +(d.accuracy * 100).toFixed(1),
  }))

  return (
    <div style={{ height: '250px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={11} angle={-45} textAnchor="end" height={50} />
          <YAxis fontSize={12} />
          <Tooltip
            formatter={(value, name) => [
              name === 'brier' ? Number(value).toFixed(3) : `${value}%`,
              name === 'brier' ? 'Brier Score' : 'Accuracy',
            ]}
          />
          <ReferenceLine y={0.25} stroke="#e74c3c" strokeDasharray="5 5" label={{ value: 'baseline', fontSize: 10 }} />
          <Line type="monotone" dataKey="brier" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Brier Score" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

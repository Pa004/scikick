import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { MatchdayStats } from '../types'
import { useLanguage } from '../i18n'

interface MatchdayChartProps {
  data: MatchdayStats[]
}

const tooltipStyle = { background: '#1a2238', border: '1px solid #2a3350', borderRadius: '8px', color: '#e2e8f0' }

export default function MatchdayChart({ data }: MatchdayChartProps) {
  const { t } = useLanguage()
  if (data.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>{t('noMatchdayData')}</p>
  }

  const chartData = data.map(d => ({
    date: d.matchday.slice(5),
    brier: +d.brier.toFixed(3),
    accuracy: +(d.accuracy * 100).toFixed(1),
  }))

  return (
    <div className="card-flat" style={{ padding: '0.75rem', height: '280px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3350" />
          <XAxis dataKey="date" fontSize={11} angle={-45} textAnchor="end" height={50} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
          <YAxis fontSize={12} stroke="#64748b" tick={{ fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              name === 'brier' ? Number(value).toFixed(3) : `${value}%`,
              name === 'brier' ? t('brierScore') : t('accuracyPct'),
            ]}
          />
          <ReferenceLine y={0.25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: t('baseline'), fontSize: 10, fill: '#94a3b8' }} />
          <Line type="monotone" dataKey="brier" stroke="url(#lineGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', stroke: '#8b5cf6' }} name={t('brierScore')} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

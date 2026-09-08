import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { MatchdayStats } from '../types'
import { useLanguage } from '../i18n'
import { useChartTheme } from './charts/chartTheme'

interface MatchdayChartProps {
  data: MatchdayStats[]
}

export default function MatchdayChart({ data }: MatchdayChartProps) {
  const { t } = useLanguage()
  const chart = useChartTheme()
  if (data.length === 0) {
    return <p className="text-sm text-faint">{t('noMatchdayData')}</p>
  }

  const chartData = data.map(d => ({
    date: d.matchday.slice(5),
    brier: +d.brier.toFixed(3),
    accuracy: +(d.accuracy * 100).toFixed(1),
  }))
  const summary = `${t('brierScore')}: ${chartData[0].brier} → ${chartData[chartData.length - 1].brier}`

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div role="img" aria-label={summary} className="h-70">
      <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis dataKey="date" fontSize={11} angle={-45} textAnchor="end" height={50} stroke={chart.grid} tick={{ fill: chart.tick }} />
          <YAxis fontSize={12} stroke={chart.grid} tick={{ fill: chart.tick }} />
          <Tooltip
            contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px', color: chart.tooltipText }}
            formatter={(value, name) => [
              name === 'brier' ? Number(value).toFixed(3) : `${value}%`,
              name === 'brier' ? t('brierScore') : t('accuracyPct'),
            ]}
          />
          <ReferenceLine y={0.25} stroke={chart.reference} strokeDasharray="5 5" label={{ value: t('baseline'), fontSize: 10, fill: chart.tick }} />
          <Line type="monotone" dataKey="brier" stroke={chart.accent} strokeWidth={2.5} dot={{ r: 3, fill: chart.accentDot }} name={t('brierScore')} />
        </LineChart>
      </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{t('tableDate')}</th>
            <th scope="col">{t('brierScore')}</th>
            <th scope="col">{t('accuracyPct')}</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map(row => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td>{row.brier}</td>
              <td>{row.accuracy}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

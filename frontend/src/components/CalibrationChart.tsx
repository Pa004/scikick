import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { CalibrationBin } from '../types'
import { useLanguage, fillVars } from '../i18n'

interface CalibrationChartProps {
  data: CalibrationBin[]
}

const tooltipStyle = { background: '#1a2238', border: '1px solid #2a3350', borderRadius: '8px', color: '#e2e8f0' }

export default function CalibrationChart({ data }: CalibrationChartProps) {
  const { t } = useLanguage()
  if (data.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>{t('noCalibrationData')}</p>
  }

  const chartData = data.map(d => ({
    x: d.avg_predicted * 100,
    y: d.actual_accuracy * 100,
    count: d.count,
  }))
  const summary = `${t('predictedPct')} / ${t('actualPct')}: ${fillVars(t('chartBins'), { n: chartData.length })}`

  return (
    <div className="card-flat" style={{ padding: '0.75rem', height: '280px' }}>
      <div role="img" aria-label={summary} style={{ height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3350" />
          <XAxis
            type="number"
            dataKey="x"
            name={t('predictedPct')}
            domain={[0, 100]}
            fontSize={12}
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
            label={{ value: t('predictedPct'), position: 'bottom', fontSize: 12, fill: '#94a3b8' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={t('actualPct')}
            domain={[0, 100]}
            fontSize={12}
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
            label={{ value: t('actualPct'), angle: -90, position: 'left', fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, props) => [
              `${Number(value).toFixed(1)}% (n=${props.payload.count})`,
              name === 'x' ? t('predictedPct') : t('actualPct'),
            ]}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="#ef4444"
            strokeDasharray="5 5"
            name={t('perfect')}
          />
          <Scatter data={chartData} fill="var(--accent)" />
        </ScatterChart>
      </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{t('predictedPct')}</th>
            <th scope="col">{t('actualPct')}</th>
            <th scope="col">{t('total')}</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row, i) => (
            <tr key={i}>
              <td>{row.x.toFixed(1)}%</td>
              <td>{row.y.toFixed(1)}%</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

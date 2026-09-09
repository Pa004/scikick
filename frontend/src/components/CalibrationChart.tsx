import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { CalibrationBin } from '../types'
import { useLanguage, fillVars } from '../i18n'
import { useChartTheme } from './charts/chartTheme'

interface CalibrationChartProps {
  data: CalibrationBin[]
}

export default function CalibrationChart({ data }: CalibrationChartProps) {
  const { t } = useLanguage()
  const chart = useChartTheme()
  if (data.length === 0) {
    return <p className="text-sm text-faint">{t('noCalibrationData')}</p>
  }

  const chartData = data.map(d => ({
    x: d.avg_predicted * 100,
    y: d.actual_accuracy * 100,
    count: d.count,
  }))
  const summary = `${t('predictedPct')} / ${t('actualPct')}: ${fillVars(t('chartBins'), { n: chartData.length })}`

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div role="img" aria-label={summary} className="h-70">
      <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name={t('predictedPct')}
            domain={[0, 100]}
            fontSize={12}
            stroke={chart.grid}
            tick={{ fill: chart.tick }}
            label={{ value: t('predictedPct'), position: 'bottom', fontSize: 12, fill: chart.tick }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={t('actualPct')}
            domain={[0, 100]}
            fontSize={12}
            stroke={chart.grid}
            tick={{ fill: chart.tick }}
            label={{ value: t('actualPct'), angle: -90, position: 'left', fontSize: 12, fill: chart.tick }}
          />
          <Tooltip
            contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '12px', color: chart.tooltipText }}
            formatter={(value, name, props) => [
              `${Number(value).toFixed(1)}% (n=${props.payload.count})`,
              name === 'x' ? t('predictedPct') : t('actualPct'),
            ]}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke={chart.reference}
            strokeDasharray="5 5"
            name={t('perfect')}
          />
          <Scatter data={chartData} fill={chart.accent} />
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

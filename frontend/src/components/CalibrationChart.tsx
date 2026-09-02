import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { CalibrationBin } from '../types'

interface CalibrationChartProps {
  data: CalibrationBin[]
}

export default function CalibrationChart({ data }: CalibrationChartProps) {
  if (data.length === 0) {
    return <p style={{ color: '#999' }}>No calibration data available.</p>
  }

  const chartData = data.map(d => ({
    x: d.avg_predicted * 100,
    y: d.actual_accuracy * 100,
    count: d.count,
  }))

  return (
    <div style={{ height: '250px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Predicted"
            domain={[0, 100]}
            fontSize={12}
            label={{ value: 'Predicted %', position: 'bottom', fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Actual"
            domain={[0, 100]}
            fontSize={12}
            label={{ value: 'Actual %', angle: -90, position: 'left', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name, props) => [
              `${Number(value).toFixed(1)}% (n=${props.payload.count})`,
              name === 'x' ? 'Predicted' : 'Actual',
            ]}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="#e74c3c"
            strokeDasharray="5 5"
            name="Perfect"
          />
          <Scatter data={chartData} fill="#3b82f6" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

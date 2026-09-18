import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageProvider } from '../i18n'
import type { CalibrationBin } from '../types'
import CalibrationChart from './CalibrationChart'

// Recharts only draws with measured sizes; jsdom provides none.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe(target: Element) {
      this.cb([{ target, contentRect: { width: 400, height: 280 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  })
})

const bins: CalibrationBin[] = [
  { bin_center: 0.4, avg_predicted: 0.4, actual_accuracy: 0.45, count: 99 },
  { bin_center: 0.7, avg_predicted: 0.73, actual_accuracy: 1, count: 3 },
]

function renderChart() {
  return render(
    <LanguageProvider>
      <CalibrationChart data={bins} />
    </LanguageProvider>,
  )
}

describe('CalibrationChart', () => {
  it('sizes dots by sample count so small bins do not read as certainties', () => {
    const { container } = renderChart()
    const radii = Array.from(container.querySelectorAll('circle')).map(c => Number(c.getAttribute('r')))
    expect(radii).toHaveLength(2)
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii))
  })

  it('labels the ideal diagonal', () => {
    renderChart()
    expect(screen.getAllByText('Perfect').length).toBeGreaterThan(0)
  })

  it('shows an empty state without bins', () => {
    render(
      <LanguageProvider>
        <CalibrationChart data={[]} />
      </LanguageProvider>,
    )
    expect(screen.getByText('No calibration data available.')).toBeDefined()
  })
})

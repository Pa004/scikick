import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMovement } from './useMovement'

beforeEach(() => {
  localStorage.clear()
})

describe('useMovement', () => {
  it('reports flat on first view', () => {
    const { result } = renderHook(() => useMovement(1, '1x2', { home: 0.5, draw: 0.25, away: 0.25 }))
    expect(result.current).toEqual({ home: 'flat', draw: 'flat', away: 'flat' })
  })

  it('detects up and down moves on second view', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useMovement(1, '1x2', data),
      { initialProps: { data: { home: 0.5, draw: 0.25, away: 0.25 } } },
    )
    rerender({ data: { home: 0.55, draw: 0.25, away: 0.2 } })
    expect(result.current).toEqual({ home: 'up', draw: 'flat', away: 'down' })
  })

  it('ignores sub-threshold noise', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useMovement(1, '1x2', data),
      { initialProps: { data: { home: 0.5 } } },
    )
    rerender({ data: { home: 0.502 } })
    expect(result.current).toEqual({ home: 'flat' })
  })

  it('keeps markets independent', () => {
    const { result, rerender } = renderHook(
      ({ market, data }: { market: string; data: Record<string, number> }) => useMovement(1, market, data),
      { initialProps: { market: '1x2', data: { home: 0.5 } } as { market: string; data: Record<string, number> } },
    )
    rerender({ market: 'btts', data: { yes: 0.6 } })
    expect(result.current).toEqual({ yes: 'flat' })
  })
})

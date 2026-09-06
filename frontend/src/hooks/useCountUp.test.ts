import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from './useCountUp'

let rafCb: FrameRequestCallback | null = null

function stubEnv(reduced: boolean) {
  rafCb = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCb = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
}

beforeEach(() => {
  stubEnv(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCountUp', () => {
  it('starts at zero and animates toward the target', () => {
    const { result } = renderHook(() => useCountUp(150, 600))
    expect(result.current).toBe(0)
    const t0 = performance.now()
    act(() => {
      rafCb?.(t0 + 300)
    })
    expect(result.current).toBeGreaterThan(0)
    act(() => {
      rafCb?.(t0 + 10000)
    })
    expect(result.current).toBe(150)
  })

  it('returns the target immediately with reduced motion', () => {
    stubEnv(true)
    const { result } = renderHook(() => useCountUp(150))
    expect(result.current).toBe(150)
    expect(rafCb).toBeNull()
  })
})

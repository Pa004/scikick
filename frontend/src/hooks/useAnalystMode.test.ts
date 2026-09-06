import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalystMode } from './useAnalystMode'

const STORAGE_KEY = 'scikick.analyst-mode'

beforeEach(() => {
  localStorage.clear()
})

describe('useAnalystMode', () => {
  it('defaults to off without stored value', () => {
    const { result } = renderHook(() => useAnalystMode())
    expect(result.current[0]).toBe(false)
  })

  it('persists the analyst flag', () => {
    const { result } = renderHook(() => useAnalystMode())
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('reads a stored opt-in', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    const { result } = renderHook(() => useAnalystMode())
    expect(result.current[0]).toBe(true)
  })
})

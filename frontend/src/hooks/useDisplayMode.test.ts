import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDisplayMode } from './useDisplayMode'

const STORAGE_KEY = 'scikick.display-mode'

beforeEach(() => {
  localStorage.clear()
})

describe('useDisplayMode', () => {
  it('defaults to prob without stored value', () => {
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current[0]).toBe('prob')
  })

  it('persists odds to localStorage', () => {
    const { result } = renderHook(() => useDisplayMode())
    act(() => result.current[1]('odds'))
    expect(result.current[0]).toBe('odds')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('odds')
  })

  it('falls back to prob on corrupt value', () => {
    localStorage.setItem(STORAGE_KEY, 'xyz')
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current[0]).toBe('prob')
  })
})

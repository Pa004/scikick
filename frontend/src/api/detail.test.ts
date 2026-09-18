import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearDetailCaches, getCachedValue, prefetchValues } from './detail'
import type { ValueResponse } from '../types'

const stored: ValueResponse = {
  fixture_id: 1,
  source: 'best-eu',
  outcomes: {
    home: { prob: 0.5, odds: 2.1, edge: 0.09, value: true, kelly: 0.02 },
  },
}

beforeEach(() => {
  clearDetailCaches()
})

describe('prefetchValues', () => {
  it('fills the cache from a single batch request', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      json: async () => ({ values: { 1: stored, 2: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await prefetchValues([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/value/batch')
    expect(getCachedValue(1)).toEqual(stored)
    expect(getCachedValue(2)).toBeNull()
  })

  it('falls back to single requests when batch fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/value/batch')) return { ok: false, status: 500 }
      return { ok: true, json: async () => stored }
    })
    vi.stubGlobal('fetch', fetchMock)
    await prefetchValues([1])
    expect(getCachedValue(1)).toEqual(stored)
  })

  it('skips already cached ids', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: { 1: stored } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await prefetchValues([1])
    await prefetchValues([1])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

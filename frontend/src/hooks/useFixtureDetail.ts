import { useEffect, useState } from 'react'
import { fetchFixtureDetail, type DetailBundle } from '../api/detail'
import type { Fixture } from '../types'

interface DetailState {
  data: DetailBundle | null
  loading: boolean
  error: boolean
}

// Per-fixture detail with session cache + abort. Collapsing a card
// aborts its in-flight requests; reopening serves the cache.
export function useFixtureDetail(fixture: Fixture | null): DetailState & { retry: () => void } {
  const [data, setData] = useState<DetailBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (fixture === null) return
    const { id, home, away } = fixture
    const controller = new AbortController()
    let active = true
    setData(null)
    setLoading(true)
    setError(false)
    fetchFixtureDetail(id, home, away, controller.signal)
      .then(bundle => {
        if (!active) return
        setData(bundle)
        setLoading(false)
      })
      .catch(err => {
        if (!active) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(true)
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [fixture, attempt])

  return { data, loading, error, retry: () => setAttempt(a => a + 1) }
}

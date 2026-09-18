import { useEffect, useRef, useState } from 'react'
import type { Fixture } from '../types'
import { fetchFixtures } from '../api'
import { LEAGUES } from '../components/layout/LeagueSwitcher'

// Single source for feed fixtures: league fetch + league counts + retry.
// Replaces the scattered fetchFixtures calls with shared loading semantics.
export function useFixtures(league: string, limit: number, upcoming: boolean) {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [leagueCounts, setLeagueCounts] = useState<Record<string, number> | undefined>(undefined)
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    const wantLeague = league === '' ? 'all' : league
    setLoading(true)
    setError(false)
    fetchFixtures(wantLeague, limit, upcoming)
      .then(data => {
        if (id !== requestId.current) return
        setFixtures(data)
        setFetchedAt(Date.now())
        setLoading(false)
      })
      .catch(() => {
        if (id !== requestId.current) return
        setFixtures([])
        setLoading(false)
        setError(true)
      })
  }, [league, limit, upcoming, attempt])

  useEffect(() => {
    let active = true
    fetchFixtures('all', 100, upcoming)
      .then(all => {
        if (!active) return
        const counts: Record<string, number> = { '': all.length }
        for (const l of LEAGUES) {
          if (l.code === '') continue
          counts[l.code] = all.filter(f => f.league === l.code).length
        }
        setLeagueCounts(counts)
      })
      .catch(() => {
        // Counts are decorative; feed still works without them
      })
    return () => {
      active = false
    }
  }, [fetchedAt, attempt, upcoming])

  return {
    fixtures,
    loading,
    error,
    fetchedAt,
    leagueCounts,
    retry: () => setAttempt(a => a + 1),
  }
}

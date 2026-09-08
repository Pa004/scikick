import type { CalibrationData, Fixture, MatchdayData, Stats } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures(league?: string, limit = 30): Promise<Fixture[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (league) params.set('league', league)
  const data = await fetchJson<{ fixtures: Fixture[] }>(`${API_BASE}/fixtures?${params}`)
  return data.fixtures || []
}

export async function fetchStats(market = '1x2', league?: string): Promise<Stats> {
  const params = new URLSearchParams({ market })
  if (league) params.set('league', league)
  return fetchJson<Stats>(`${API_BASE}/stats?${params}`)
}

export async function fetchMatchdayStats(market = '1x2', league?: string): Promise<MatchdayData> {
  const params = new URLSearchParams({ market })
  if (league) params.set('league', league)
  return fetchJson<MatchdayData>(`${API_BASE}/stats/per-matchday?${params}`)
}

export async function fetchCalibration(market = '1x2', league?: string): Promise<CalibrationData> {
  const params = new URLSearchParams({ market })
  if (league) params.set('league', league)
  return fetchJson<CalibrationData>(`${API_BASE}/stats/calibration?${params}`)
}

export { fetchContext, fetchPrediction, fetchScorer, fetchValue } from './api/detail'
export type { DetailBundle } from './api/detail'

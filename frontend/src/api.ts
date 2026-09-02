import type { Fixture, Prediction, Stats, MatchdayData, CalibrationData } from './types'

const API_BASE = 'http://localhost:8000/api'

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

export async function fetchPrediction(id: number): Promise<Prediction> {
  return fetchJson<Prediction>(`${API_BASE}/predict/${id}`)
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

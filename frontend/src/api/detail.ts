import type { Prediction, ScorerPrediction, TeamContext, ValueResponse } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchPrediction(id: number, signal?: AbortSignal): Promise<Prediction> {
  return fetchJson<Prediction>(`${API_BASE}/predict/${id}`, signal)
}

export async function fetchScorer(id: number, signal?: AbortSignal): Promise<ScorerPrediction> {
  const data = await fetchJson<ScorerPrediction | { detail: string }>(
    `${API_BASE}/predict/scorer/${id}`,
    signal,
  )
  if ((data as { detail?: string }).detail !== undefined) throw new Error('No scorer data')
  if (!Array.isArray((data as ScorerPrediction).scorers)) throw new Error('No scorer data')
  return data as ScorerPrediction
}

export async function fetchContext(
  team: string,
  opponent?: string,
  signal?: AbortSignal,
): Promise<TeamContext> {
  const params = new URLSearchParams({ team })
  if (opponent) params.set('opponent', opponent)
  return fetchJson<TeamContext>(`${API_BASE}/context?${params}`, signal)
}

export async function fetchValue(
  id: number,
  odds?: { home: number; draw: number; away: number },
  signal?: AbortSignal,
): Promise<ValueResponse> {
  const res = await fetch(`${API_BASE}/value`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(odds ? { fixture_id: id, odds } : { fixture_id: id }),
    signal,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export interface DetailBundle {
  prediction: Prediction
  scorer: ScorerPrediction | null
  contextHome: TeamContext | null
  contextAway: TeamContext | null
  value: ValueResponse | null
}

const bundleCache = new Map<number, DetailBundle>()
const valueCache = new Map<number, ValueResponse | null>()

export function getCachedValue(fixtureId: number): ValueResponse | null | undefined {
  return valueCache.get(fixtureId)
}

// One bundle per fixture per session: predict is required, the rest
// degrade to null so a missing scorer/context never blocks the story.
export async function fetchFixtureDetail(
  id: number,
  home: string,
  away: string,
  signal?: AbortSignal,
): Promise<DetailBundle> {
  const cached = bundleCache.get(id)
  if (cached) return cached
  const prediction = await fetchPrediction(id, signal)
  const [scorer, contextHome, contextAway, value] = await Promise.all([
    fetchScorer(id, signal).catch(() => null),
    fetchContext(home, away, signal).catch(() => null),
    fetchContext(away, home, signal).catch(() => null),
    fetchValue(id, undefined, signal)
      .then(v => {
        valueCache.set(id, v)
        return v
      })
      .catch(() => null),
  ])
  const bundle: DetailBundle = { prediction, scorer, contextHome, contextAway, value }
  bundleCache.set(id, bundle)
  return bundle
}

// Background +EV badges for the top predicted cards. Best-effort:
// failures stay undefined (no badge) and never block the feed.
export async function prefetchValues(ids: number[]): Promise<void> {
  await Promise.allSettled(
    ids
      .filter(id => !valueCache.has(id))
      .map(id =>
        fetchValue(id)
          .then(v => valueCache.set(id, v))
          .catch(() => valueCache.set(id, null)),
      ),
  )
}

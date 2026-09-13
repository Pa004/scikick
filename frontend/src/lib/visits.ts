export interface Visit {
  kind: 'match' | 'team'
  id: string
  label: string
  sub?: string
}

const STORAGE_KEY = 'scikick.recent-visits'
const MAX_VISITS = 5

function readStored(): Visit[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is Visit =>
        typeof v === 'object' && v !== null &&
        ((v as Visit).kind === 'match' || (v as Visit).kind === 'team') &&
        typeof (v as Visit).id === 'string' &&
        typeof (v as Visit).label === 'string',
    )
  } catch {
    return []
  }
}

// Most-recent-first visit history for the command palette.
// Surfaced only when the query is empty (recent-first pattern).
export function getRecentVisits(): Visit[] {
  if (typeof window === 'undefined') return []
  return readStored()
}

export function recordVisit(visit: Visit): void {
  if (typeof window === 'undefined') return
  try {
    const next = [visit, ...readStored().filter(v => !(v.kind === visit.kind && v.id === visit.id))]
      .slice(0, MAX_VISITS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode: recents last for the session only (memory skipped by design)
  }
}

export function clearRecentVisits(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: nothing persisted
  }
}

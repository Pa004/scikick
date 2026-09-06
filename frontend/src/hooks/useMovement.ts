import { useEffect, useMemo } from 'react'

export type MoveDirection = 'up' | 'down' | 'flat'
export type MoveMap = Record<string, MoveDirection>

const STORAGE_KEY = 'scikick.last-seen.v1'
const MAX_ENTRIES = 200
// Ignore sub-threshold noise so rounding jitter never flashes arrows.
const FLAT_THRESHOLD = 0.005

type SnapshotStore = Record<string, Record<string, number>>

function readSnapshots(): SnapshotStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as SnapshotStore
  } catch {
    return {}
  }
}

function writeSnapshots(all: SnapshotStore): void {
  try {
    const trimmed: SnapshotStore = {}
    for (const k of Object.keys(all).slice(-MAX_ENTRIES)) trimmed[k] = all[k]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Private mode: movements simply reset on reload
  }
}

// Compares current outcome probabilities against the last seen snapshot
// (per fixture+market) and reports direction. First view is always flat.
export function useMovement(
  fixtureId: number,
  market: string,
  data: Record<string, number> | undefined,
): MoveMap {
  const key = `${fixtureId}:${market}`

  // Derived during render (pure read); the snapshot write below is the only effect.
  const moves = useMemo(() => {
    if (!data) return {}
    const prev = readSnapshots()[key]
    const next: MoveMap = {}
    for (const [outcome, curr] of Object.entries(data)) {
      const old = prev?.[outcome]
      next[outcome] = old === undefined || Math.abs(curr - old) < FLAT_THRESHOLD
        ? 'flat'
        : curr > old ? 'up' : 'down'
    }
    return next
  }, [key, data])

  useEffect(() => {
    if (!data) return
    const all = readSnapshots()
    writeSnapshots({ ...all, [key]: { ...data } })
  }, [key, data])

  return moves
}

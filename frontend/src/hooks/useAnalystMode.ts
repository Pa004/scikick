import { useEffect, useState } from 'react'

const STORAGE_KEY = 'scikick.analyst-mode'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Gates technical detail (raw market keys, model internals, top features).
// Fan-casual UI stays clean by default.
export function useAnalystMode(): [boolean, (v: boolean) => void] {
  const [analyst, setAnalyst] = useState<boolean>(readInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, analyst ? '1' : '0')
    } catch {
      // Private mode: keep in-memory value
    }
  }, [analyst])

  return [analyst, setAnalyst]
}

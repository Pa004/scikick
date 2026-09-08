import { useCallback, useState } from 'react'

const STORAGE_KEY = 'scikick.followed-teams'

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'string') : []
  } catch {
    return []
  }
}

export function useFollowedTeams() {
  const [followed, setFollowed] = useState<string[]>(readStored)

  const toggle = useCallback((team: string) => {
    setFollowed(prev => {
      const next = prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Private mode: follows last for the session
      }
      return next
    })
  }, [])

  return { followed, toggle }
}

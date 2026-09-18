import { useCallback, useState } from 'react'
import { readJSON, writeJSON } from '../lib/storage'

const STORAGE_KEY = 'scikick.followed-teams'

const isTeamList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(t => typeof t === 'string')

export function useFollowedTeams() {
  const [followed, setFollowed] = useState<string[]>(() => readJSON(STORAGE_KEY, isTeamList, []))

  const toggle = useCallback((team: string) => {
    setFollowed(prev => {
      const next = prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
      writeJSON(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { followed, toggle }
}

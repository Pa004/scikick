import { createContext, useContext, type ReactNode } from 'react'
import { useLeagueName } from '../../hooks/useLeagueName'

interface FeedContextValue {
  followed: string[]
  onToggleFollow: (team: string) => void
  analyst: boolean
  onAnalystChange: (v: boolean) => void
  leagueName: (code: string) => string
}

const FeedContext = createContext<FeedContextValue | null>(null)

// Shared feed state that used to be drilled through
// FeedPage → FeedBoard → MatchCard untouched. Values come from the single
// App-level hook instances (never duplicated here, or toggles desync).
export function FeedProvider({
  children,
  followed,
  onToggleFollow,
  analyst,
  onAnalystChange,
}: {
  children: ReactNode
  followed: string[]
  onToggleFollow: (team: string) => void
  analyst: boolean
  onAnalystChange: (v: boolean) => void
}) {
  const leagueName = useLeagueName()
  return (
    <FeedContext.Provider
      value={{ followed, onToggleFollow, analyst, onAnalystChange, leagueName }}
    >
      {children}
    </FeedContext.Provider>
  )
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeed must be used within a FeedProvider')
  return ctx
}

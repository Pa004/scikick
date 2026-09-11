import { useCallback, useState } from 'react'

export const ACCENTS = ['tierra', 'iris'] as const
export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_ACCENT: Accent = 'tierra'

const STORAGE_KEY = 'scikick.accent'

function isAccent(v: string | null): v is Accent {
  return v === 'tierra' || v === 'iris'
}

export function readStoredAccent(): Accent {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isAccent(stored)) return stored
  } catch {
    // Private mode: fall through to default
  }
  return DEFAULT_ACCENT
}

export function applyAccent(accent: Accent): void {
  document.documentElement.dataset.accent = accent
}

export function useAccent(): { accent: Accent; setAccent: (a: Accent) => void } {
  const [accent, setAccentState] = useState<Accent>(() => {
    const initial = readStoredAccent()
    applyAccent(initial)
    return initial
  })
  const setAccent = useCallback((next: Accent) => {
    setAccentState(next)
    applyAccent(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: accent lasts for the session
    }
  }, [])
  return { accent, setAccent }
}

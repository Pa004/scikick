import { useEffect, useState } from 'react'

export type DisplayMode = 'prob' | 'odds'

const STORAGE_KEY = 'scikick.display-mode'

function readInitialMode(): DisplayMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'odds' ? 'odds' : 'prob'
  } catch {
    return 'prob'
  }
}

// Display format only (probability % vs decimal odds). Never affects data fetching.
export function useDisplayMode(): [DisplayMode, (mode: DisplayMode) => void] {
  const [mode, setMode] = useState<DisplayMode>(readInitialMode)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Private mode: keep in-memory value
    }
  }, [mode])

  return [mode, setMode]
}

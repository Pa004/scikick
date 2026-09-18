import { useEffect, useState } from 'react'
import { readString, writeString } from '../lib/storage'

export type DisplayMode = 'prob' | 'odds'

const STORAGE_KEY = 'scikick.display-mode'

// Display format only (probability % vs decimal odds). Never affects data fetching.
export function useDisplayMode(): [DisplayMode, (mode: DisplayMode) => void] {
  const [mode, setMode] = useState<DisplayMode>(
    () => (readString(STORAGE_KEY, 'prob') === 'odds' ? 'odds' : 'prob'),
  )

  useEffect(() => {
    writeString(STORAGE_KEY, mode)
  }, [mode])

  return [mode, setMode]
}

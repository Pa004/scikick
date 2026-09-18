import { useEffect, useState } from 'react'
import { readString, writeString } from '../lib/storage'

const STORAGE_KEY = 'scikick.analyst-mode'

// Gates technical detail (raw market keys, model internals, top features).
// Fan-casual UI stays clean by default.
export function useAnalystMode(): [boolean, (v: boolean) => void] {
  const [analyst, setAnalyst] = useState<boolean>(() => readString(STORAGE_KEY, '0') === '1')

  useEffect(() => {
    writeString(STORAGE_KEY, analyst ? '1' : '0')
  }, [analyst])

  return [analyst, setAnalyst]
}

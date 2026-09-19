import { useEffect, useState } from 'react'
import { useLanguage, fillVars, type TranslationKey } from '../../i18n'
import { fetchHealth } from '../../api'

interface StatusClusterProps {
  count: number
  updatedAt: number | null
}

function vintageText(
  t: (key: TranslationKey) => string,
  exportedAt: string | null,
): { short: string; full: string } {
  if (exportedAt === null) return { short: '', full: '' }
  const ms = Date.now() - Date.parse(exportedAt)
  if (!Number.isFinite(ms) || ms < 0) return { short: '', full: '' }
  const full = new Date(exportedAt).toLocaleString()
  if (ms < 60000) return { short: t('dataVintageNow'), full }
  const hours = ms / 3600000
  if (hours < 1) {
    return { short: fillVars(t('dataVintageMinutes'), { m: Math.round(ms / 60000) }), full }
  }
  if (hours < 48) {
    return { short: fillVars(t('dataVintageHours'), { h: Math.round(hours) }), full }
  }
  return { short: fillVars(t('dataVintageDays'), { d: Math.round(hours / 24) }), full }
}

// What the feed knows, without new requests: how many stories are
// loaded and how fresh they are. Data vintage comes from /health
// (exported_at); a failed fetch simply hides that segment.
export function StatusCluster({ count, updatedAt }: StatusClusterProps) {
  const { t, locale } = useLanguage()
  const [exportedAt, setExportedAt] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetchHealth().then(h => {
      if (live) setExportedAt(h.exported_at)
    })
    return () => {
      live = false
    }
  }, [])
  const ageMin = updatedAt === null ? null : Math.max(0, Math.round((Date.now() - updatedAt) / 60000))
  const fresh = ageMin === null
    ? ''
    : ageMin < 1
      ? t('statusUpdatedNow')
      : fillVars(t('statusUpdated'), { m: ageMin })
  const full = updatedAt === null
    ? ''
    : new Date(updatedAt).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US')
  const vintage = vintageText(t, exportedAt)
  return (
    <p
      className="hidden shrink-0 text-xs whitespace-nowrap text-faint tabular-nums min-[420px]:block"
      title={vintage.full === '' ? full : `${full} · ${vintage.full}`}
    >
      {fillVars(t('statusUpcoming'), { n: count })}
      {fresh !== '' && ` · ${fresh}`}
      {vintage.short !== '' && ` · ${vintage.short}`}
    </p>
  )
}

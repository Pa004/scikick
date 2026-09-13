import { useLanguage, fillVars } from '../../i18n'

interface StatusClusterProps {
  count: number
  updatedAt: number | null
}

// What the feed knows, without new requests: how many stories are
// loaded and how fresh they are.
export function StatusCluster({ count, updatedAt }: StatusClusterProps) {
  const { t, locale } = useLanguage()
  const ageMin = updatedAt === null ? null : Math.max(0, Math.round((Date.now() - updatedAt) / 60000))
  const fresh = ageMin === null
    ? ''
    : ageMin < 1
      ? t('statusUpdatedNow')
      : fillVars(t('statusUpdated'), { m: ageMin })
  const full = updatedAt === null
    ? ''
    : new Date(updatedAt).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US')
  return (
    <p
      className="hidden shrink-0 text-xs whitespace-nowrap text-faint tabular-nums min-[420px]:block"
      title={full}
    >
      {fillVars(t('statusUpcoming'), { n: count })}
      {fresh !== '' && ` · ${fresh}`}
    </p>
  )
}


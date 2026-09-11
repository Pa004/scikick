import { Link } from 'react-router'
import { useLanguage } from '../../i18n'

// Probability-ring mark: stroked ring (a neutral ~62% share) around a
// centered ball dot, all in primary-fg on a primary tile. Pure inline
// SVG, no assets.
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[10px] bg-primary"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="8.5"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="33 54"
          transform="rotate(-90 12 12)"
          style={{ stroke: 'var(--primary-fg)' }}
        />
        <circle cx="12" cy="12" r="3.5" style={{ fill: 'var(--primary-fg)' }} />
        <circle cx="17.5" cy="6" r="1.5" style={{ fill: 'var(--primary-fg)' }} />
      </svg>
    </span>
  )
}

export function BrandLockup() {
  const { t } = useLanguage()
  return (
    <Link
      to="/"
      aria-label={t('brandHome')}
      className="flex min-w-0 items-center gap-2 rounded-md"
    >
      <BrandMark />
      <span className="min-w-0">
        <span className="block font-display text-xl leading-none font-bold tracking-tight text-foreground">
          SciKick
        </span>
        <span className="mt-1 hidden text-xs text-faint md:block">{t('taglineShort')}</span>
      </span>
    </Link>
  )
}

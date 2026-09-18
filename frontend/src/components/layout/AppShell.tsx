import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Search } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { BrandLockup } from './Brand'
import { LeagueSwitcher } from './LeagueSwitcher'
import { StatusCluster } from './StatusCluster'
import { OverflowMenu } from './OverflowMenu'
import { BottomBar } from './BottomBar'
import { ThemeToggle } from '../ThemeToggle'
import { cn } from '../../lib/cn'

interface AppShellProps {
  league: string
  onLeagueChange: (code: string) => void
  analyst: boolean
  onAnalystChange: (v: boolean) => void
  onOpenModel: () => void
  onOpenSearch: () => void
  searchLabel: string
  statusCount: number
  statusUpdatedAt: number | null
  leagueCounts?: Record<string, number>
  savedCount?: number
  showValue?: boolean
  onShowValueChange?: (v: boolean) => void
  valueCount?: number
  showPast?: boolean
  onShowPastChange?: (v: boolean) => void
  actions?: ReactNode
  children: ReactNode
}

const NAV = [
  { to: '/', labelKey: 'fixtures', end: true },
  { to: '/seguidos', labelKey: 'myMatches', end: false },
] as const

export function AppShell({
  league,
  onLeagueChange,
  analyst,
  onAnalystChange,
  onOpenModel,
  onOpenSearch,
  searchLabel,
  statusCount,
  statusUpdatedAt,
  leagueCounts,
  savedCount,
  showValue,
  onShowValueChange,
  valueCount,
  showPast,
  onShowPastChange,
  actions,
  children,
}: AppShellProps) {
  const { t, locale, setLocale } = useLanguage()
  const { pathname } = useLocation()
  // Feed-scoped filters: dead weight on team/followed pages.
  const isFeed = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <header className={cn('sticky top-0 z-40 bg-surface pt-3 pb-3 transition-shadow', scrolled && 'shadow-[0_1px_8px_oklch(20%_0.02_240_/_0.08)]')}>
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 lg:px-6">
          <BrandLockup />
          <nav aria-label={t('navMain')} className="ml-2 hidden items-center gap-1 min-[420px]:flex">
            {NAV.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 px-3 py-2 text-[15px] font-bold transition-colors',
                    isActive
                      ? 'border-accent text-foreground'
                      : 'border-transparent text-muted hover:text-foreground',
                  )
                }
              >
                {t(l.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label={searchLabel}
              title={`${searchLabel} (Ctrl+K)`}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] pr-2 pl-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground sm:pr-2.5"
            >
              <Search aria-hidden="true" className="size-5" />
              <kbd aria-hidden="true" className="hidden rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-xs font-semibold text-faint lg:inline">
                Ctrl K
              </kbd>
            </button>
            <div role="group" aria-label={t('language')} className="flex shrink-0 items-center rounded-[10px] border border-border p-0.5">
              {(['es', 'en'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={locale === l}
                  aria-label={l === 'es' ? 'Español' : 'English'}
                  onClick={() => setLocale(l)}
                  className={cn(
                    'min-h-9 cursor-pointer rounded-[8px] px-2 font-mono text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    locale === l ? 'bg-foreground text-background' : 'text-faint hover:text-foreground',
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <ThemeToggle />
            <OverflowMenu analyst={analyst} onAnalystChange={onAnalystChange} onOpenModel={onOpenModel} />
          </div>
        </div>
        <div className="bg-surface">
          <div className="mx-auto flex h-12 w-full max-w-[1440px] items-center gap-3 px-4 lg:px-6">
            <div className="min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_92%,transparent)]">
              <LeagueSwitcher league={league} onChange={onLeagueChange} compact counts={leagueCounts} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isFeed && onShowValueChange !== undefined && showValue !== undefined && (
                <>
                  <button
                    type="button"
                    aria-pressed={showValue}
                    aria-label={t('valueOnly')}
                    title="Filtrar solo cuotas con valor +EV"
                    onClick={() => onShowValueChange(!showValue)}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border px-3 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      showValue ? 'border-primary bg-primary text-primary-fg shadow-sm' : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    <span>{t('valueOnly')}</span>
                    {valueCount !== undefined && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold tabular-nums',
                          showValue ? 'bg-white/20 text-primary-fg' : 'bg-surface-alt text-faint',
                        )}
                      >
                        {valueCount}
                      </span>
                    )}
                  </button>
                  <span aria-live="polite" aria-atomic="true" className="sr-only">
                    {showValue ? `Filtrado a ${valueCount ?? 0} partidos con valor` : 'Mostrando todos los partidos'}
                  </span>
                </>
              )}
              {isFeed && onShowPastChange !== undefined && showPast !== undefined && (
                <>
                  <button
                    type="button"
                    aria-pressed={showPast}
                    aria-label={t('showPast')}
                    title={t('showPastHint')}
                    onClick={() => onShowPastChange(!showPast)}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border px-3 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      showPast ? 'border-primary bg-primary text-primary-fg shadow-sm' : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    <span>{t('showPast')}</span>
                  </button>
                  <span aria-live="polite" aria-atomic="true" className="sr-only">
                    {showPast ? t('showingPast') : t('showingUpcoming')}
                  </span>
                </>
              )}
              <StatusCluster count={statusCount} updatedAt={statusUpdatedAt} />
            </div>
          </div>
        </div>
      </header>
      {actions}
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-28 md:pb-10 lg:px-6">
        {children}
        <footer className="mt-10 pt-4 pb-2 text-xs text-faint">
          {t('disclaimer')}
        </footer>
      </div>
      <BottomBar onOpenSearch={onOpenSearch} savedCount={savedCount} />
    </div>
  )
}

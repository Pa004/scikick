import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
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
  actions,
  children,
}: AppShellProps) {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-3 px-4">
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
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onOpenModel}
              title={t('aboutModel')}
              className="border-b-2 border-transparent px-3 py-2 text-[15px] font-bold text-muted transition-colors hover:text-foreground"
            >
              {t('modelTrust')}
            </button>
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
            <ThemeToggle />
            <OverflowMenu analyst={analyst} onAnalystChange={onAnalystChange} onOpenModel={onOpenModel} />
          </div>
        </div>
        <div className="border-t border-border bg-surface">
          <div className="mx-auto flex h-12 w-full max-w-[1180px] items-center gap-3 px-4">
            <div className="min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_92%,transparent)]">
              <LeagueSwitcher league={league} onChange={onLeagueChange} compact counts={leagueCounts} />
            </div>
            <StatusCluster count={statusCount} updatedAt={statusUpdatedAt} />
          </div>
        </div>
      </header>
      {actions}
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-28 md:pb-10">
        {children}
        <footer className="mt-10 border-t border-border pt-4 pb-2 text-xs text-faint">
          {t('disclaimer')}
        </footer>
      </div>
      <BottomBar onOpenSearch={onOpenSearch} onOpenModel={onOpenModel} savedCount={savedCount} />
    </div>
  )
}

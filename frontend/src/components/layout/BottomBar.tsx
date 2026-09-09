import { House, Star, Search, Gauge } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

interface BottomBarProps {
  onOpenSearch: () => void
  onOpenModel: () => void
}

// Thumb-zone navigation for small screens: the mobile tabs row is
// replaced by this floating bar. Tapping the active destination
// scrolls back to top (self-evident refresh).
export function BottomBar({ onOpenSearch, onOpenModel }: BottomBarProps) {
  const { t } = useLanguage()
  const { pathname } = useLocation()

  const scrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Non-visual env
    }
  }

  const item = 'flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors'

  return (
    <nav
      aria-label={t('navMain')}
      className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-border bg-surface/95 shadow-lg backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch gap-1 p-1.5">
        <NavLink
          to="/"
          end
          onClick={() => {
            if (pathname === '/') scrollTop()
          }}
          className={({ isActive }) =>
            cn(item, isActive ? 'text-primary-strong' : 'text-faint')
          }
        >
          <House aria-hidden="true" className="size-5" />
          {t('fixtures')}
        </NavLink>
        <NavLink
          to="/seguidos"
          onClick={() => {
            if (pathname === '/seguidos') scrollTop()
          }}
          className={({ isActive }) =>
            cn(item, isActive ? 'text-primary-strong' : 'text-faint')
          }
        >
          <Star aria-hidden="true" className="size-5" />
          {t('myMatches')}
        </NavLink>
        <button type="button" onClick={onOpenSearch} aria-label={t('searchCommand')} className={cn(item, 'text-faint')}>
          <Search aria-hidden="true" className="size-5" />
          {t('searchCommand').split(' ')[0]}
        </button>
        <button type="button" onClick={onOpenModel} aria-haspopup="dialog" className={cn(item, 'text-faint')}>
          <Gauge aria-hidden="true" className="size-5" />
          {t('modelTrust')}
        </button>
      </div>
    </nav>
  )
}

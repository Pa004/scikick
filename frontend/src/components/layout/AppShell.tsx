import type { ReactNode } from 'react'
import { useLanguage } from '../../i18n'
import { LeagueSwitcher } from './LeagueSwitcher'
import { LanguageSelector } from '../LanguageSelector'
import AnalystToggle from '../AnalystToggle'
import { ThemeToggle } from '../ThemeToggle'

interface AppShellProps {
  league: string
  onLeagueChange: (code: string) => void
  analyst: boolean
  onAnalystChange: (v: boolean) => void
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ league, onLeagueChange, analyst, onAnalystChange, actions, children }: AppShellProps) {
  const { t } = useLanguage()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            SciKick
          </h1>
          <p className="mt-1 text-sm text-muted">{t('tagline')}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <LeagueSwitcher league={league} onChange={onLeagueChange} />
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            {actions}
            <LanguageSelector />
            <AnalystToggle analyst={analyst} onChange={onAnalystChange} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
      <footer className="mt-10 border-t border-border pt-4 pb-2 text-xs text-faint">
        {t('disclaimer')}
      </footer>
    </div>
  )
}

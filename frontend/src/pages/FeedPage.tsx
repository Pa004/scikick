import type { Fixture } from '../types'
import { useNavigate } from 'react-router'
import { useLanguage } from '../i18n'
import { FeedBoard } from '../components/feed/FeedBoard'
import { Button } from '../components/ui/button'

interface FeedPageProps {
  fixtures: Fixture[]
  loading: boolean
  error: boolean
  onRetry: () => void
  leagueName: (code: string) => string
  followed: string[]
  onToggleFollow: (team: string) => void
  analyst: boolean
  showValue: boolean
}

export function FeedPage({
  fixtures,
  loading,
  error,
  onRetry,
  leagueName,
  followed,
  onToggleFollow,
  analyst,
  showValue,
}: FeedPageProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <main id="main-content">
      <h1 className="mb-2 font-display text-lg font-semibold text-foreground">
        {t('fixtures')}
      </h1>
      {error ? (
        <div
          role="alert"
          className="animate-fade rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink"
        >
          <p className="mb-2 font-medium">{t('backendError')}</p>
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <FeedBoard
          fixtures={fixtures}
          loading={loading}
          leagueName={leagueName}
          followed={followed}
          onToggleFollow={onToggleFollow}
          analyst={analyst}
          fixturesForContext={fixtures}
          showValue={showValue}
          onDeepLink={id => navigate(`/partido/${id}`, { replace: true })}
        />
      )}
    </main>
  )
}

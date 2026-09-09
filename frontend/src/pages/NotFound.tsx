import { Link } from 'react-router'
import { useLanguage } from '../i18n'
import { Button } from '../components/ui/button'

export function NotFound() {
  const { t } = useLanguage()
  return (
    <main id="main-content">
      <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t('notFoundTitle')}
        </h2>
        <p className="mx-auto mt-2 mb-4 max-w-md text-sm text-muted">{t('notFoundText')}</p>
        <Button type="button" variant="primary" asChild>
          <Link to="/">{t('backToFeed')}</Link>
        </Button>
      </div>
    </main>
  )
}

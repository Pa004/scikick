import { Link } from 'react-router'
import { useLanguage } from '../i18n'
import { Button } from '../components/ui/button'

export function NotFound() {
  const { t } = useLanguage()
  return (
    <main id="main-content">
      <div className="rounded-[14px] border border-border bg-surface p-7 text-center">
        <h1 className="text-[30px] leading-tight font-bold text-balance text-foreground">
          {t('notFoundTitle')}
        </h1>
        <p className="mx-auto mt-2 mb-4 max-w-[65ch] text-[15px] text-muted">{t('notFoundText')}</p>
        <Button type="button" variant="primary" asChild>
          <Link to="/">{t('backToFeed')}</Link>
        </Button>
      </div>
    </main>
  )
}

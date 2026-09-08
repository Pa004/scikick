import { useLanguage, type Locale } from '../i18n'
import { cn } from '../lib/cn'

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
]

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex rounded-full border border-border bg-surface-alt p-0.5"
    >
      {OPTIONS.map(({ value, label, name }) => {
        const isActive = value === locale
        return (
          <button
            key={value}
            type="button"
            lang={value}
            aria-label={name}
            aria-pressed={isActive}
            onClick={() => setLocale(value)}
            className={cn(
              'min-h-9 cursor-pointer rounded-full px-2.5 text-xs font-bold transition-colors duration-150',
              isActive ? 'bg-primary text-primary-fg shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

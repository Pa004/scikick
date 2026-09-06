import { useLanguage, type Locale } from '../i18n'
import type { ComponentProps } from 'react'

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
]

type ButtonProps = ComponentProps<'button'>

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t('language')}
      className="pill"
    >
      {OPTIONS.map(({ value, label, name }) => {
        const isActive = value === locale
        const common: ButtonProps = {
          onClick: () => setLocale(value),
          'aria-pressed': isActive,
          className: `pill-btn ${isActive ? 'pill-btn-active' : ''}`,
        }
        return (
          <button key={value} lang={value} aria-label={name} {...common}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

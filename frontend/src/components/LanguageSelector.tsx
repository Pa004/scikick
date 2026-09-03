import { useLanguage, type Locale } from '../i18n'
import type { ComponentProps } from 'react'

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

type ButtonProps = ComponentProps<'button'>

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage()

  return (
    <div
      role="group"
      aria-label="Language"
      className="pill"
    >
      {OPTIONS.map(({ value, label }) => {
        const isActive = value === locale
        const common: ButtonProps = {
          onClick: () => setLocale(value),
          'aria-pressed': isActive,
          className: `pill-btn ${isActive ? 'pill-btn-active' : ''}`,
        }
        return (
          <button key={value} {...common}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

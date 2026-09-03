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
      style={{
        display: 'inline-flex',
        border: '1px solid #e5e7eb',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      {OPTIONS.map(({ value, label }) => {
        const isActive = value === locale
        const common: ButtonProps = {
          onClick: () => setLocale(value),
          'aria-pressed': isActive,
          style: {
            border: 'none',
            background: isActive ? '#3b82f6' : 'transparent',
            color: isActive ? '#fff' : '#666',
            padding: '4px 14px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          },
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

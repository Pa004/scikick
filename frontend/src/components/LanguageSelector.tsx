import { useLanguage, type Locale } from '../i18n'
import { SegmentedButton, SegmentedGroup } from './ui/segmented'

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
]

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage()

  return (
    <SegmentedGroup label={t('language')}>
      {OPTIONS.map(({ value, label, name }) => (
        <SegmentedButton
          key={value}
          active={value === locale}
          lang={value}
          aria-label={name}
          onClick={() => setLocale(value)}
          className="min-h-9 px-2.5 text-xs font-bold"
        >
          {label}
        </SegmentedButton>
      ))}
    </SegmentedGroup>
  )
}

import { useLanguage } from '../i18n'

interface AnalystToggleProps {
  analyst: boolean
  onChange: (v: boolean) => void
}

export default function AnalystToggle({ analyst, onChange }: AnalystToggleProps) {
  const { t } = useLanguage()

  return (
    <button
      type="button"
      aria-pressed={analyst}
      aria-label={t('analystMode')}
      title={t('analystMode')}
      onClick={() => onChange(!analyst)}
      className="league-tab"
      style={analyst ? { background: 'var(--accent)', borderColor: 'transparent', color: '#0a0e1a' } : undefined}
    >
      {t('analyst')}
    </button>
  )
}

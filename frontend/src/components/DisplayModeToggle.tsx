import { useLanguage } from '../i18n'
import type { DisplayMode } from '../hooks/useDisplayMode'

interface DisplayModeToggleProps {
  mode: DisplayMode
  onChange: (mode: DisplayMode) => void
}

export default function DisplayModeToggle({ mode, onChange }: DisplayModeToggleProps) {
  const { t } = useLanguage()

  return (
    <div role="group" aria-label={t('displayModeLabel')} className="pill">
      <button
        type="button"
        aria-pressed={mode === 'prob'}
        onClick={() => onChange('prob')}
        className={`pill-btn${mode === 'prob' ? ' pill-btn-active' : ''}`}
      >
        {t('displayProb')}
      </button>
      <button
        type="button"
        aria-pressed={mode === 'odds'}
        onClick={() => onChange('odds')}
        className={`pill-btn${mode === 'odds' ? ' pill-btn-active' : ''}`}
      >
        {t('displayOdds')}
      </button>
    </div>
  )
}

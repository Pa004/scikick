import { useLanguage } from '../i18n'
import type { DisplayMode } from '../hooks/useDisplayMode'
import { SegmentedButton, SegmentedGroup } from './ui/segmented'

interface DisplayModeToggleProps {
  mode: DisplayMode
  onChange: (mode: DisplayMode) => void
}

export default function DisplayModeToggle({ mode, onChange }: DisplayModeToggleProps) {
  const { t } = useLanguage()

  return (
    <SegmentedGroup label={t('displayModeLabel')}>
      <SegmentedButton active={mode === 'prob'} onClick={() => onChange('prob')}>
        {t('displayProb')}
      </SegmentedButton>
      <SegmentedButton active={mode === 'odds'} onClick={() => onChange('odds')}>
        {t('displayOdds')}
      </SegmentedButton>
    </SegmentedGroup>
  )
}

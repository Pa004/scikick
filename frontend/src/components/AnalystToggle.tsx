import { FlaskConical } from 'lucide-react'
import { useLanguage } from '../i18n'
import { Button } from './ui/button'

interface AnalystToggleProps {
  analyst: boolean
  onChange: (v: boolean) => void
}

export default function AnalystToggle({ analyst, onChange }: AnalystToggleProps) {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="sm"
      variant={analyst ? 'primary' : 'secondary'}
      aria-pressed={analyst}
      title={t('analystMode')}
      onClick={() => onChange(!analyst)}
    >
      <FlaskConical aria-hidden="true" />
      {t('analyst')}
    </Button>
  )
}

import { Moon, Sun } from 'lucide-react'
import { useLanguage } from '../i18n'
import { useTheme } from '../theme/theme-context'
import { Button } from './ui/button'

export function ThemeToggle() {
  const { t } = useLanguage()
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? t('themeSwitchToLight') : t('themeSwitchToDark')}
      title={dark ? t('themeSwitchToLight') : t('themeSwitchToDark')}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}

import { useLanguage } from '../i18n'
import { LEAGUES } from '../components/layout/LeagueSwitcher'

// One league-code → display-name mapping for every page.
export function useLeagueName(): (code: string) => string {
  const { t } = useLanguage()
  return (code: string) => {
    const found = LEAGUES.find(l => l.code === code)
    return found ? t(found.labelKey) : code
  }
}

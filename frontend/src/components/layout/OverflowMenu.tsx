import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useLanguage, type Locale } from '../../i18n'
import { useTheme } from '../../theme/theme-context'
import { ACCENTS, useAccent, type Accent } from '../../theme/accent'
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '../ui/dropdown'

interface OverflowMenuProps {
  analyst: boolean
  onAnalystChange: (v: boolean) => void
  onOpenModel: () => void
}

const LOCALES: { value: Locale; label: string; name: string }[] = [
  { value: 'es', label: 'Español', name: 'ES' },
  { value: 'en', label: 'English', name: 'EN' },
]

// Decorative brand dots (not text: no contrast requirement).
const ACCENT_DOTS: Record<Accent, string> = {
  iris: '#5b5bd6',
  ember: '#f76b15',
  electric: '#0090ff',
}

export function OverflowMenu({ analyst, onAnalystChange, onOpenModel }: OverflowMenuProps) {
  const { t, locale, setLocale } = useLanguage()
  const { theme, toggle } = useTheme()
  const { accent, setAccent } = useAccent()
  const [open, setOpen] = useState(false)

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('moreOptions')}
          aria-expanded={open}
          title={t('moreOptions')}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" aria-label={t('moreOptions')}>
        <MenuLabel>{t('languageName')}</MenuLabel>
        {LOCALES.map(l => (
          <MenuCheckboxItem
            key={l.value}
            checked={locale === l.value}
            onCheckedChange={() => setLocale(l.value)}
          >
            <span lang={l.value}>{l.label}</span>
            <span className="ml-auto text-xs text-faint">{l.name}</span>
          </MenuCheckboxItem>
        ))}
        <MenuSeparator />
        <MenuCheckboxItem checked={analyst} onCheckedChange={onAnalystChange}>
          {t('analystSwitch')}
        </MenuCheckboxItem>
        <MenuItem onSelect={toggle}>
          {theme === 'dark' ? t('themeSwitchToLight') : t('themeSwitchToDark')}
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('accentName')}</MenuLabel>
        <MenuRadioGroup value={accent} onValueChange={v => setAccent(v as Accent)} aria-label={t('accentName')}>
          {ACCENTS.map(a => (
            <MenuRadioItem key={a} value={a}>
              <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: ACCENT_DOTS[a] }} />
              {t(`accent_${a}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={onOpenModel}>{t('aboutModel')}</MenuItem>
      </MenuContent>
    </Menu>
  )
}

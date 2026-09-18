import type { Locale } from '../i18n'
import type { FormOutcome } from './matchCenter'

// Visible form letters follow the UI language.
export function formLetter(o: FormOutcome, locale: Locale): string {
  if (locale === 'es') return o === 'W' ? 'V' : o === 'D' ? 'E' : 'D'
  return o
}

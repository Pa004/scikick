import type { OutcomeProbs } from './matchCenter'
import type { Locale } from '../i18n'

export type VerdictOutcome = 'home' | 'draw' | 'away'

export interface Verdict {
  outcome: VerdictOutcome
  teamLabel: string
  prob: number
}

// Strongest outcome wins; ties resolve home-first, matching the grid's
// favorite highlight so row and cells never disagree.
export function getVerdict(home: string, away: string, probs: OutcomeProbs): Verdict {
  const outcome: VerdictOutcome =
    probs.home >= probs.draw && probs.home >= probs.away
      ? 'home'
      : probs.draw >= probs.away ? 'draw' : 'away'
  return {
    outcome,
    teamLabel: outcome === 'home' ? home : outcome === 'away' ? away : '',
    prob: probs[outcome],
  }
}

// Frequency framing ("6 in 10") reads naturally in both locales; the caller
// composes it with its i18n template since word order differs per language.
export function formatFrequency(prob: number): number {
  if (!Number.isFinite(prob)) return 0
  return Math.min(10, Math.max(0, Math.round(prob * 10)))
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Noon-parse avoids UTC midnight shifting the day in negative offsets.
export function formatHumanDate(iso: string, locale: Locale, now: Date = new Date()): string {
  const parts = iso.split('-').map(Number)
  if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) return iso
  const day = startOfDay(new Date(parts[0], parts[1] - 1, parts[2], 12))
  const diff = Math.round((day.getTime() - startOfDay(now).getTime()) / 86400000)
  if (diff === 0) return locale === 'es' ? 'Hoy' : 'Today'
  if (diff === 1) return locale === 'es' ? 'Mañana' : 'Tomorrow'
  if (diff === -1) return locale === 'es' ? 'Ayer' : 'Yesterday'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(day)
}

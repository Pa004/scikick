import type { Fixture } from '../../types'
import type { Locale } from '../../i18n'
import { extract1x2, type OutcomeProbs } from '../../utils/matchCenter'
import {
  formatFrequency,
  formatHumanDate as baseFormatHumanDate,
  getVerdict,
} from '../../utils/verdict'

export function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

export function formatHumanDate(iso: string, locale: Locale): string {
  return baseFormatHumanDate(iso, locale)
}

export interface VerdictView {
  outcome: 'home' | 'draw' | 'away'
  teamLabel: string
  frequency: number
}

export function fixtureVerdict(f: Fixture): VerdictView | null {
  const probs: OutcomeProbs | null = extract1x2(f.prediction)
  if (!probs) return null
  const v = getVerdict(f.home, f.away, probs)
  return { outcome: v.outcome, teamLabel: v.teamLabel, frequency: formatFrequency(v.prob) }
}

export function matchesQuery(f: Fixture, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(q)
}

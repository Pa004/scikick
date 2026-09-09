import type { Fixture } from '../../types'
import type { Locale } from '../../i18n'
import { extract1x2, type OutcomeProbs } from '../../utils/matchCenter'
import {
  formatFrequency,
  formatHumanDate as baseFormatHumanDate,
  getVerdict,
} from '../../utils/verdict'
import { displayTeam, stripDiacritics, teamMatchesQuery } from '../../utils/teamNames'

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
  return { outcome: v.outcome, teamLabel: displayTeam(v.teamLabel), frequency: formatFrequency(v.prob) }
}

export function matchesQuery(f: Fixture, query: string): boolean {
  const words = stripDiacritics(query.trim().toLowerCase()).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  // Single-field fast path (team names, accent-insensitive)
  if (teamMatchesQuery(f.home, query) || teamMatchesQuery(f.away, query)) return true
  // Cross-field: every word must appear somewhere across teams/league
  const hay = stripDiacritics(
    `${f.home} ${displayTeam(f.home)} ${f.away} ${displayTeam(f.away)} ${f.league}`.toLowerCase(),
  )
  return words.every(w => hay.includes(w))
}

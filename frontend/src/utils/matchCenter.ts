import type { Fixture } from '../types'

export type FormOutcome = 'W' | 'D' | 'L'

export interface OutcomeProbs {
  home: number
  draw: number
  away: number
}

// Narrow a raw market record to 1X2 shares; null when any side
// is missing or non-numeric (nested ht/ft groups included).
export function asOutcomeProbs(record: Record<string, unknown> | null | undefined): OutcomeProbs | null {
  if (!record) return null
  const { home, draw, away } = record as Record<string, unknown>
  if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') return null
  if (!Number.isFinite(home) || !Number.isFinite(draw) || !Number.isFinite(away)) return null
  return { home, draw, away }
}

export interface H2HMeeting {
  date: string
  home: string
  away: string
  homeScore: number
  awayScore: number
}

export interface H2HSummary {
  homeWins: number
  draws: number
  awayWins: number
  meetings: H2HMeeting[]
}

export interface ComboLeg {
  market: string
  outcome: string
  prob: number
}

export interface SuperCombo {
  legs: ComboLeg[]
  estimate: number | null
}

export interface DayPick {
  fixtureId: number
  home: string
  away: string
  league: string
  date: string
  outcome: string
  prob: number
}

function isResolved(f: Fixture): f is Fixture & { home_score: number; away_score: number } {
  return f.status === 'post' && f.home_score !== null && f.away_score !== null
}

// Accepts both embedded shapes: { probabilities: {home,draw,away} }
// and { markets: { '1x2': {home,draw,away} } }.
export function extract1x2(prediction: Record<string, unknown> | null): OutcomeProbs | null {
  if (!prediction) return null
  const markets = prediction['markets']
  const candidates = [
    prediction['probabilities'],
    typeof markets === 'object' && markets !== null
      ? (markets as Record<string, unknown>)['1x2']
      : undefined,
  ]
  for (const cand of candidates) {
    if (typeof cand !== 'object' || cand === null) continue
    const rec = cand as Record<string, unknown>
    const { home, draw, away } = rec
    if (typeof home === 'number' && typeof draw === 'number' && typeof away === 'number') {
      return { home, draw, away }
    }
  }
  return null
}

// Last N outcomes from the team's perspective, most recent first.
export function getTeamForm(fixtures: Fixture[], team: string, last = 5): FormOutcome[] {
  return fixtures
    .filter(isResolved)
    .filter(f => f.home === team || f.away === team)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, last)
    .map(f => {
      const scored = f.home === team ? f.home_score : f.away_score
      const conceded = f.home === team ? f.away_score : f.home_score
      return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D'
    })
}

// Past meetings between both teams (either venue), most recent first.
export function getHeadToHead(home: string, away: string, fixtures: Fixture[]): H2HSummary {
  const meetings = fixtures
    .filter(isResolved)
    .filter(f =>
      (f.home === home && f.away === away) || (f.home === away && f.away === home),
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
  let homeWins = 0
  let awayWins = 0
  for (const m of meetings) {
    const homeScored = m.home === home ? m.home_score : m.away_score
    const awayScored = m.home === home ? m.away_score : m.home_score
    if (homeScored > awayScored) homeWins += 1
    else if (awayScored > homeScored) awayWins += 1
  }
  return {
    homeWins,
    draws: meetings.length - homeWins - awayWins,
    awayWins,
    meetings: meetings.map(m => ({
      date: m.date,
      home: m.home,
      away: m.away,
      homeScore: m.home_score,
      awayScore: m.away_score,
    })),
  }
}

function formPoints(form: FormOutcome[]): number {
  return form.reduce((acc, o) => acc + (o === 'W' ? 3 : o === 'D' ? 1 : 0), 0)
}

// Points share over the same window, so both bars are comparable.
export function getMomentum(homeForm: FormOutcome[], awayForm: FormOutcome[]): { homePct: number; awayPct: number } {
  const window = Math.max(homeForm.length, awayForm.length, 1)
  return {
    homePct: (formPoints(homeForm) / (3 * window)) * 100,
    awayPct: (formPoints(awayForm) / (3 * window)) * 100,
  }
}

function topEntry(data: Record<string, number>): [string, number] | null {
  let best: [string, number] | null = null
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'number') continue
    if (!best || v > best[1]) best = [k, v]
  }
  return best
}

// Display-only combo: strongest outcome per market. Missing markets are
// omitted, never invented; estimate assumes independence (labeled as such).
export function getSuperCombo(probabilities: Record<string, Record<string, number>>): SuperCombo {
  const legs: ComboLeg[] = []
  const push = (market: string) => {
    const data = probabilities[market]
    if (!data) return
    const top = topEntry(data)
    if (top) legs.push({ market, outcome: top[0], prob: top[1] })
  }
  push('1x2')
  push('over_under_2.5')
  push('btts')
  return {
    legs,
    estimate: legs.length > 0 ? legs.reduce((acc, l) => acc * l.prob, 1) : null,
  }
}

// Highest model confidence among loaded fixtures. Tiebreaks: probability
// gap over the runner-up, then earliest date. Returns null when no fixture
// carries extractable 1X2 — the UI must show the empty state instead.
export function selectPickOfDay(fixtures: Fixture[]): DayPick | null {
  let best: DayPick | null = null
  let bestGap = -1
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 7)
  const horizonStr = horizon.toISOString().slice(0, 10)
  for (const f of fixtures) {
    if (f.date > horizonStr) continue
    const p = extract1x2(f.prediction)
    if (!p) continue
    const ranked = [
      { outcome: 'home', prob: p.home },
      { outcome: 'draw', prob: p.draw },
      { outcome: 'away', prob: p.away },
    ].sort((a, b) => b.prob - a.prob)
    const gap = ranked[0].prob - ranked[1].prob
    const wins = !best
      || ranked[0].prob > best.prob
      || (ranked[0].prob === best.prob && (gap > bestGap || (gap === bestGap && f.date < best.date)))
    if (wins) {
      best = { fixtureId: f.id, home: f.home, away: f.away, league: f.league, date: f.date, outcome: ranked[0].outcome, prob: ranked[0].prob }
      bestGap = gap
    }
  }
  return best
}

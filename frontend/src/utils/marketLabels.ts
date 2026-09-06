import type { Locale } from '../i18n'

// Natural-language labels for betting markets and outcomes (fan-casual
// default). Technical codes (1X2/BTTS/snake_case) survive only in analyst
// mode (Fase 3). Locale-parameterized so utils stay pure and DOM-free;
// components pass `locale` from useLanguage(). Unknown keys never crash:
// humanizeFallback always returns readable text.

export function humanizeFallback(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  if (!words) return '—'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function parseLine(market: string): string | null {
  const m = market.match(/_([+-]?\d+(?:\.\d+)?)$/)
  return m ? m[1] : null
}

function sportNoun(market: string, locale: Locale): string {
  if (market.startsWith('corners_')) return locale === 'es' ? 'córners' : 'corners'
  if (market.startsWith('cards_')) return locale === 'es' ? 'tarjetas' : 'cards'
  return locale === 'es' ? 'goles' : 'goals'
}

const MARKET_NAMES: Record<string, [string, string]> = {
  '1x2': ['Resultado final', 'Full-time result'],
  double_chance: ['Doble oportunidad', 'Double chance'],
  draw_no_bet: ['Empate anula', 'Draw no bet'],
  clean_sheet: ['Portería a cero', 'Clean sheet'],
  win_to_nil: ['Gana sin encajar', 'Win to nil'],
  btts: ['Ambos marcan', 'Both teams score'],
  exact_score: ['Marcador exacto', 'Exact score'],
  total_goals: ['Total de goles', 'Total goals'],
  corners_total: ['Total de córners', 'Total corners'],
  cards_total: ['Total de tarjetas', 'Total cards'],
  goal_bands: ['Tramos de goles', 'Goal bands'],
  odd_even: ['Par o impar', 'Odd or even'],
  ht_1x2: ['Resultado 1ª mitad', '1st-half result'],
  ht_double_chance: ['Doble oportunidad 1ª mitad', '1st-half double chance'],
  both_halves: ['Rendimiento por mitades', 'Half performance'],
  ft_result_given_ht: ['Resultado final dado el descanso', 'Full-time given half-time'],
  highest_scoring_half: ['Mitad con más goles', 'Highest scoring half'],
  home_o25: ['Local y más de 2.5', 'Home and over 2.5'],
  home_btts: ['Local y ambos marcan', 'Home and both score'],
  away_btts: ['Visitante y ambos marcan', 'Away and both score'],
  dc_o25: ['Doble oportunidad y más de 2.5', 'Double chance and over 2.5'],
  dc_u25: ['Doble oportunidad y menos de 2.5', 'Double chance and under 2.5'],
  draw_u25: ['Empate y menos de 2.5', 'Draw and under 2.5'],
  '1x2_btts': ['Resultado y ambos marcan', 'Result and both score'],
}

function handicapName(market: string, locale: Locale): string | null {
  if (!market.includes('handicap')) return null
  const line = parseLine(market)
  const scope = market.startsWith('corners_')
    ? (locale === 'es' ? 'de córners' : 'Corners')
    : market.startsWith('cards_')
      ? (locale === 'es' ? 'de tarjetas' : 'Cards')
      : ''
  const asian = market.includes('asian_')
    ? (locale === 'es' ? 'Hándicap asiático' : 'Asian handicap')
    : (locale === 'es' ? 'Hándicap' : 'Handicap')
  if (locale === 'es') return `${asian}${scope ? ` ${scope}` : ''}${line ? ` ${line}` : ''}`
  return scope ? `${scope} handicap${line ? ` ${line}` : ''}` : `${asian}${line ? ` ${line}` : ''}`
}

export function getMarketLabel(market: string, locale: Locale): string {
  const fixed = MARKET_NAMES[market]
  if (fixed) return locale === 'es' ? fixed[0] : fixed[1]
  if (market.startsWith('corners_over_under_') || market.startsWith('cards_over_under_')) {
    const noun = sportNoun(market, locale)
    const line = parseLine(market)
    return locale === 'es' ? `Más / Menos${line ? ` ${line}` : ''} ${noun}` : `Over / Under${line ? ` ${line}` : ''} ${noun}`
  }
  if (market.startsWith('ht_over_under_')) {
    const line = parseLine(market)
    return locale === 'es'
      ? `Más / Menos${line ? ` ${line}` : ''} goles en 1ª mitad`
      : `Over / Under${line ? ` ${line}` : ''} 1st-half goals`
  }
  if (market.startsWith('over_under_')) {
    const line = parseLine(market)
    return locale === 'es' ? `Más / Menos${line ? ` ${line}` : ''} goles` : `Over / Under${line ? ` ${line}` : ''} goals`
  }
  const hc = handicapName(market, locale)
  if (hc) return hc
  return humanizeFallback(market)
}

const THREE_WAY = new Set([
  '1x2', 'ht_1x2', 'win_to_nil', 'draw_no_bet', 'handicap_-2', 'handicap_-1',
  'handicap_+1', 'handicap_+2', 'asian_handicap_-0.5', 'asian_handicap_+0.5',
])

function threeWayOutcome(outcome: string, locale: Locale): string {
  if (outcome === 'home') return locale === 'es' ? 'Local' : 'Home'
  if (outcome === 'away') return locale === 'es' ? 'Visitante' : 'Away'
  return locale === 'es' ? 'Empate' : 'Draw'
}

function doubleChanceOutcome(outcome: string, locale: Locale): string {
  const es = locale === 'es'
  if (outcome === 'home_or_draw') return es ? 'Local o empate' : 'Home or draw'
  if (outcome === 'draw_or_away') return es ? 'Empate o visitante' : 'Draw or away'
  if (outcome === 'home_or_away') return es ? 'Local o visitante' : 'Home or away'
  return humanizeFallback(outcome)
}

function overUnderOutcome(market: string, outcome: string, locale: Locale): string {
  const line = parseLine(market)
  const suffix = line ? ` ${line}` : ''
  if (outcome === 'over') return locale === 'es' ? `Más${suffix}` : `Over${suffix}`
  if (outcome === 'under') return locale === 'es' ? `Menos${suffix}` : `Under${suffix}`
  return humanizeFallback(outcome)
}

function halvesOutcome(outcome: string, locale: Locale): string {
  const es = locale === 'es'
  const map: Record<string, [string, string]> = {
    team_wins_both_halves: ['Gana ambas mitades', 'Wins both halves'],
    team_wins_either_half: ['Gana alguna mitad', 'Wins either half'],
    draw_both_halves: ['Empata ambas mitades', 'Draws both halves'],
    both_teams_score_both_halves: ['Ambos marcan en ambas', 'Both score in both'],
    'ht_over_0.5_ft_over_0.5': ['Más 0.5 al descanso y al final', 'Over 0.5 HT and FT'],
    'ht_over_1.5_ft_over_1.5': ['Más 1.5 al descanso y al final', 'Over 1.5 HT and FT'],
    'ht_over_2.5_ft_over_2.5': ['Más 2.5 al descanso y al final', 'Over 2.5 HT and FT'],
  }
  const hit = map[outcome]
  if (hit) return es ? hit[0] : hit[1]
  return humanizeFallback(outcome)
}

function combinedOutcome(outcome: string, locale: Locale): string {
  const es = locale === 'es'
  const tokens: Record<string, [string, string]> = {
    home: ['Gana el local', 'Home win'],
    draw: ['Empate', 'Draw'],
    away: ['Gana el visitante', 'Away win'],
    dc: ['Doble oportunidad', 'Double chance'],
    o25: ['más de 2.5 goles', 'over 2.5 goals'],
    over: ['más de 2.5 goles', 'over 2.5 goals'],
    u25: ['menos de 2.5 goles', 'under 2.5 goals'],
    under: ['menos de 2.5 goles', 'under 2.5 goals'],
    btts: ['ambos marcan', 'both score'],
    yes: ['sí', 'yes'],
    no: ['no', 'no'],
    '1x2': ['Resultado', 'Result'],
  }
  const parts = outcome.split('_').map(tok => {
    const hit = tokens[tok]
    if (hit) return es ? hit[0] : hit[1]
    if (/^\d+(\.\d+)?$/.test(tok)) return tok
    return humanizeFallback(tok)
  })
  return parts.join(es ? ' y ' : ' and ')
}

function htScoreOutcome(outcome: string, locale: Locale): string {
  const m = outcome.match(/^ht_(\d+-\d+)_ft_1x2$/)
  if (!m) return humanizeFallback(outcome)
  return locale === 'es' ? `Descanso ${m[1]}` : `Half-time ${m[1]}`
}

export function getOutcomeLabel(market: string, outcome: string, locale: Locale): string {
  if (market === 'btts') {
    if (outcome === 'yes') return locale === 'es' ? 'Sí, ambos marcan' : 'Yes, both score'
    if (outcome === 'no') return locale === 'es' ? 'No' : 'No'
    return humanizeFallback(outcome)
  }
  if (market === 'odd_even') {
    if (outcome === 'odd') return locale === 'es' ? 'Impar' : 'Odd'
    if (outcome === 'even') return locale === 'es' ? 'Par' : 'Even'
    return humanizeFallback(outcome)
  }
  if (market === 'clean_sheet') {
    const es = locale === 'es'
    if (outcome === 'home_yes') return es ? 'Local sí' : 'Home yes'
    if (outcome === 'home_no') return es ? 'Local no' : 'Home no'
    if (outcome === 'away_yes') return es ? 'Visitante sí' : 'Away yes'
    if (outcome === 'away_no') return es ? 'Visitante no' : 'Away no'
    return humanizeFallback(outcome)
  }
  if (market === 'goal_bands') {
    const es = locale === 'es'
    if (outcome === '0') return es ? 'Sin goles' : 'No goals'
    if (outcome === '5+') return es ? '5 o más' : '5 or more'
    if (/^\d+-\d+$/.test(outcome)) return es ? `${outcome} goles` : `${outcome} goals`
    return humanizeFallback(outcome)
  }
  if (market === 'exact_score') {
    if (outcome === 'other') return locale === 'es' ? 'Otro' : 'Other'
    return outcome
  }
  if (market === 'total_goals' || market === 'corners_total' || market === 'cards_total') {
    return outcome
  }
  if (market === 'both_halves') return halvesOutcome(outcome, locale)
  if (market === 'highest_scoring_half') {
    const es = locale === 'es'
    if (outcome === 'first') return es ? 'Primera parte' : 'First half'
    if (outcome === 'second') return es ? 'Segunda parte' : 'Second half'
    if (outcome === 'equal') return es ? 'Igualadas' : 'Level'
    return humanizeFallback(outcome)
  }
  if (market === 'ft_result_given_ht') return htScoreOutcome(outcome, locale)
  if (market === 'double_chance' || market === 'ht_double_chance') {
    return doubleChanceOutcome(outcome, locale)
  }
  if (market === 'draw_no_bet' && outcome === 'draw') {
    return locale === 'es' ? 'Empate (anula)' : 'Draw (void)'
  }
  if (THREE_WAY.has(market) || market.includes('handicap')) {
    return threeWayOutcome(outcome, locale)
  }
  if (market.includes('over_under')) return overUnderOutcome(market, outcome, locale)
  if (['home_o25', 'home_btts', 'away_btts', 'dc_o25', 'dc_u25', 'draw_u25', '1x2_btts'].includes(market)) {
    return combinedOutcome(outcome, locale)
  }
  return humanizeFallback(outcome)
}

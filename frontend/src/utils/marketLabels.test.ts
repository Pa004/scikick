import { describe, it, expect } from 'vitest'
import { getMarketLabel, getOutcomeLabel, humanizeFallback } from './marketLabels'

describe('humanizeFallback', () => {
  it('never crashes or returns empty', () => {
    expect(humanizeFallback('foo_bar_baz')).toBe('Foo bar baz')
    expect(humanizeFallback('')).toBe('—')
    expect(humanizeFallback('___')).toBe('—')
    expect(humanizeFallback('x')).toBe('X')
  })
})

describe('getMarketLabel', () => {
  it('names fixed markets in both locales', () => {
    expect(getMarketLabel('1x2', 'es')).toBe('Resultado final')
    expect(getMarketLabel('1x2', 'en')).toBe('Full-time result')
    expect(getMarketLabel('btts', 'es')).toBe('Ambos marcan')
    expect(getMarketLabel('ht_1x2', 'es')).toBe('Resultado 1ª mitad')
    expect(getMarketLabel('highest_scoring_half', 'en')).toBe('Highest scoring half')
    expect(getMarketLabel('corners_total', 'es')).toBe('Total de córners')
  })

  it('interpolates over/under lines', () => {
    expect(getMarketLabel('over_under_2.5', 'es')).toBe('Más / Menos 2.5 goles')
    expect(getMarketLabel('over_under_0.5', 'en')).toBe('Over / Under 0.5 goals')
    expect(getMarketLabel('corners_over_under_10.5', 'es')).toBe('Más / Menos 10.5 córners')
    expect(getMarketLabel('cards_over_under_8.5', 'en')).toBe('Over / Under 8.5 cards')
    expect(getMarketLabel('ht_over_under_1.5', 'es')).toBe('Más / Menos 1.5 goles en 1ª mitad')
  })

  it('interpolates handicap lines with signs', () => {
    expect(getMarketLabel('handicap_-1', 'es')).toBe('Hándicap -1')
    expect(getMarketLabel('handicap_+1', 'en')).toBe('Handicap +1')
    expect(getMarketLabel('asian_handicap_+0.5', 'es')).toBe('Hándicap asiático +0.5')
    expect(getMarketLabel('corners_handicap_-2', 'es')).toBe('Hándicap de córners -2')
    expect(getMarketLabel('cards_handicap_+1', 'en')).toBe('Cards handicap +1')
  })

  it('falls back gracefully on unknown markets', () => {
    expect(getMarketLabel('mystery_market', 'es')).toBe('Mystery market')
    expect(getMarketLabel('mystery_market', 'es')).not.toContain('_')
  })
})

describe('getOutcomeLabel', () => {
  it('translates three-way outcomes', () => {
    expect(getOutcomeLabel('1x2', 'home', 'es')).toBe('Local')
    expect(getOutcomeLabel('1x2', 'draw', 'en')).toBe('Draw')
    expect(getOutcomeLabel('asian_handicap_+0.5', 'away', 'es')).toBe('Visitante')
    expect(getOutcomeLabel('corners_handicap_-1', 'home', 'en')).toBe('Home')
  })

  it('marks void draws explicitly', () => {
    expect(getOutcomeLabel('draw_no_bet', 'draw', 'es')).toBe('Empate (anula)')
    expect(getOutcomeLabel('draw_no_bet', 'home', 'es')).toBe('Local')
  })

  it('translates double chance combinations', () => {
    expect(getOutcomeLabel('double_chance', 'home_or_draw', 'es')).toBe('Local o empate')
    expect(getOutcomeLabel('double_chance', 'draw_or_away', 'en')).toBe('Draw or away')
    expect(getOutcomeLabel('ht_double_chance', 'home_or_away', 'es')).toBe('Local o visitante')
  })

  it('attaches lines to over/under outcomes', () => {
    expect(getOutcomeLabel('over_under_2.5', 'over', 'es')).toBe('Más 2.5')
    expect(getOutcomeLabel('over_under_2.5', 'under', 'en')).toBe('Under 2.5')
    expect(getOutcomeLabel('corners_over_under_9.5', 'over', 'es')).toBe('Más 9.5')
  })

  it('translates btts, odd/even, clean sheets and bands', () => {
    expect(getOutcomeLabel('btts', 'yes', 'es')).toBe('Sí, ambos marcan')
    expect(getOutcomeLabel('btts', 'no', 'en')).toBe('No')
    expect(getOutcomeLabel('odd_even', 'odd', 'es')).toBe('Impar')
    expect(getOutcomeLabel('odd_even', 'even', 'en')).toBe('Even')
    expect(getOutcomeLabel('clean_sheet', 'away_yes', 'es')).toBe('Visitante sí')
    expect(getOutcomeLabel('goal_bands', '0', 'es')).toBe('Sin goles')
    expect(getOutcomeLabel('goal_bands', '5+', 'en')).toBe('5 or more')
    expect(getOutcomeLabel('goal_bands', '1-2', 'es')).toBe('1-2 goles')
  })

  it('keeps scores and totals raw, translates other', () => {
    expect(getOutcomeLabel('exact_score', '1-0', 'es')).toBe('1-0')
    expect(getOutcomeLabel('exact_score', 'other', 'es')).toBe('Otro')
    expect(getOutcomeLabel('total_goals', '3', 'es')).toBe('3')
    expect(getOutcomeLabel('corners_total', '16+', 'en')).toBe('16+')
  })

  it('translates halves and half-time score groups', () => {
    expect(getOutcomeLabel('both_halves', 'team_wins_both_halves', 'es')).toBe('Gana ambas mitades')
    expect(getOutcomeLabel('both_halves', 'ht_over_1.5_ft_over_1.5', 'en')).toBe('Over 1.5 HT and FT')
    expect(getOutcomeLabel('highest_scoring_half', 'equal', 'es')).toBe('Igualadas')
    expect(getOutcomeLabel('ft_result_given_ht', 'ht_0-0_ft_1x2', 'es')).toBe('Descanso 0-0')
    expect(getOutcomeLabel('ft_result_given_ht', 'ht_1-2_ft_1x2', 'en')).toBe('Half-time 1-2')
  })

  it('composes combined outcomes from tokens', () => {
    expect(getOutcomeLabel('1x2_btts', 'home_o25', 'es')).toBe('Gana el local y más de 2.5 goles')
    expect(getOutcomeLabel('dc_u25', 'draw_u25', 'es')).toBe('Empate y menos de 2.5 goles')
    expect(getOutcomeLabel('home_btts', 'home_yes', 'en')).toBe('Home win and yes')
  })

  it('falls back on unknown outcomes without underscores', () => {
    const label = getOutcomeLabel('1x2', 'weird_outcome', 'es')
    expect(label).not.toContain('_')
    expect(label.length).toBeGreaterThan(0)
  })
})

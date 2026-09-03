export type MarketCategoryKey = 'results' | 'goals' | 'handicap' | 'corners' | 'cards' | 'firstHalf' | 'halfFull' | 'combined'

export const MARKET_CATEGORIES: Record<MarketCategoryKey, string[]> = {
  results: ['1x2', 'double_chance', 'draw_no_bet', 'clean_sheet', 'win_to_nil'],
  goals: [
    'over_under_0.5', 'over_under_1.5', 'over_under_2.5', 'over_under_3.5', 'over_under_4.5',
    'btts', 'exact_score', 'total_goals', 'goal_bands', 'odd_even',
  ],
  handicap: [
    'handicap_-1', 'handicap_+1', 'handicap_-2', 'handicap_+2',
    'asian_handicap_-0.5', 'asian_handicap_+0.5',
  ],
  corners: ['corners_over_under_9.5', 'corners_over_under_10.5', 'corners_over_under_11.5', 'corners_handicap_-1', 'corners_handicap_+1'],
  cards: ['cards_over_under_8.5', 'cards_over_under_9.5', 'cards_over_under_10.5', 'cards_handicap_-1', 'cards_handicap_+1'],
  firstHalf: ['ht_1x2', 'ht_over_under_0.5', 'ht_over_under_1.5', 'ht_double_chance'],
  halfFull: ['both_halves', 'ft_result_given_ht'],
  combined: ['home_o25', 'home_btts', 'dc_o25', 'dc_u25', '1x2_btts'],
}

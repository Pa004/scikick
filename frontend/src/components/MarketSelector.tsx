export const MARKET_CATEGORIES: Record<string, string[]> = {
  "Resultados": ['1x2', 'double_chance', 'draw_no_bet', 'clean_sheet', 'win_to_nil'],
  "Goles": [
    'over_under_0.5', 'over_under_1.5', 'over_under_2.5', 'over_under_3.5', 'over_under_4.5',
    'btts', 'exact_score', 'total_goals', 'goal_bands', 'odd_even',
  ],
  "Handicap": [
    'handicap_-1', 'handicap_+1', 'handicap_-2', 'handicap_+2',
    'asian_handicap_-0.5', 'asian_handicap_+0.5',
  ],
  "Corners": ['corners_over_under_9.5', 'corners_over_under_10.5', 'corners_over_under_11.5', 'corners_handicap_-1', 'corners_handicap_+1'],
  "Tarjetas": ['cards_over_under_8.5', 'cards_over_under_9.5', 'cards_over_under_10.5', 'cards_handicap_-1', 'cards_handicap_+1'],
  "1ª Mitad": ['ht_1x2', 'ht_over_under_0.5', 'ht_over_under_1.5', 'ht_double_chance'],
  "Mitad/Final": ['both_halves', 'ft_result_given_ht'],
  "Combinados": ['home_o25', 'home_btts', 'dc_o25', 'dc_u25', '1x2_btts'],
}

interface MarketSelectorProps {
  selected: string
  onChange: (market: string) => void
  availableMarkets?: string[]
}

export default function MarketSelector({ selected, onChange, availableMarkets }: MarketSelectorProps) {
  return (
    <select
      value={selected}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}
    >
      {Object.entries(MARKET_CATEGORIES).map(([category, markets]) => {
        const visible = availableMarkets
          ? markets.filter(m => availableMarkets.includes(m))
          : markets
        if (visible.length === 0) return null
        return (
          <optgroup key={category} label={category}>
            {visible.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

import { useLanguage, marketCategoryLabel } from '../i18n'
import { MARKET_CATEGORIES, type MarketCategoryKey } from './marketCategories'

interface MarketSelectorProps {
  selected: string
  onChange: (market: string) => void
  availableMarkets?: string[]
}

export default function MarketSelector({ selected, onChange, availableMarkets }: MarketSelectorProps) {
  const { t } = useLanguage()

  return (
    <select
      value={selected}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}
    >
      {Object.entries(MARKET_CATEGORIES).map(([category, markets]) => {
        const key = category as MarketCategoryKey
        const visible = availableMarkets
          ? markets.filter(m => availableMarkets.includes(m))
          : markets
        if (visible.length === 0) return null
        return (
          <optgroup key={category} label={t(marketCategoryLabel(key))}>
            {visible.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

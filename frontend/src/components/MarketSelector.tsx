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
      className="select-dark"
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

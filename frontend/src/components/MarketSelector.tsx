import { useState } from 'react'
import { useLanguage, marketCategoryLabel } from '../i18n'
import { MARKET_CATEGORIES, type MarketCategoryKey } from './marketCategories'

interface MarketSelectorProps {
  selected: string
  onChange: (market: string) => void
  availableMarkets?: string[]
}

function findCategory(market: string, available?: string[]): MarketCategoryKey | null {
  for (const [category, markets] of Object.entries(MARKET_CATEGORIES)) {
    const visible = available ? markets.filter(m => available.includes(m)) : markets
    if (visible.includes(market)) return category as MarketCategoryKey
  }
  return null
}

export default function MarketSelector({ selected, onChange, availableMarkets }: MarketSelectorProps) {
  const { t } = useLanguage()
  // Derived state (React-endorsed "previous render info" pattern):
  // manual toggles persist, but programmatic market changes re-open their group.
  const [nav, setNav] = useState(() => ({
    prevSelected: selected,
    open: findCategory(selected, availableMarkets) ?? 'results' as MarketCategoryKey | null,
  }))
  if (nav.prevSelected !== selected) {
    setNav({ prevSelected: selected, open: findCategory(selected, availableMarkets) ?? 'results' })
  }
  const openCategory = nav.open
  const setOpenCategory = (open: MarketCategoryKey | null) => setNav(n => ({ ...n, open }))

  return (
    <div className="market-groups">
      {(Object.entries(MARKET_CATEGORIES) as [MarketCategoryKey, string[]][]).map(([category, markets]) => {
        const visible = availableMarkets
          ? markets.filter(m => availableMarkets.includes(m))
          : markets
        if (visible.length === 0) return null
        const isOpen = openCategory === category
        return (
          <div key={category} className="market-group">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`market-panel-${category}`}
              id={`market-header-${category}`}
              onClick={() => setOpenCategory(isOpen ? null : category)}
              className="market-group-header"
            >
              <span>{t(marketCategoryLabel(category))}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>{visible.length}</span>
                <span aria-hidden="true" className="market-group-chevron">▾</span>
              </span>
            </button>
            <div role="region" id={`market-panel-${category}`} aria-labelledby={`market-header-${category}`} hidden={!isOpen}>
              <div className="market-options">
                {visible.map(m => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === selected}
                    onClick={() => onChange(m)}
                    className={`market-option${m === selected ? ' market-option-active' : ''}`}
                  >
                    {m.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import { useLanguage, marketCategoryLabel } from '../i18n'
import { getMarketLabel } from '../utils/marketLabels'
import { MARKET_CATEGORIES, type MarketCategoryKey } from './marketCategories'

interface MarketSelectorProps {
  selected: string
  onChange: (market: string) => void
  availableMarkets?: string[]
  analyst?: boolean
}

const PREFIX_CATEGORY: [string, MarketCategoryKey][] = [
  ['corners_', 'corners'],
  ['cards_', 'cards'],
  ['ht_', 'firstHalf'],
  ['ft_result_given_ht', 'halfFull'],
  ['both_halves', 'halfFull'],
  ['over_under_', 'goals'],
  ['handicap_', 'handicap'],
  ['asian_handicap_', 'handicap'],
]

function findCategory(market: string, available?: string[]): MarketCategoryKey | null {
  for (const [category, markets] of Object.entries(MARKET_CATEGORIES)) {
    const visible = available ? markets.filter(m => available.includes(m)) : markets
    if (visible.includes(market)) return category as MarketCategoryKey
  }
  for (const [prefix, category] of PREFIX_CATEGORY) {
    if (market.startsWith(prefix) && (!available || available.includes(market))) {
      return category
    }
  }
  return null
}

export default function MarketSelector({ selected, onChange, availableMarkets, analyst = false }: MarketSelectorProps) {
  const { t, locale } = useLanguage()
  const availKey = (availableMarkets ?? []).join('|')
  // Derived state (React-endorsed "previous render info" pattern):
  // manual toggles persist, but programmatic market changes re-open their group.
  const [nav, setNav] = useState(() => ({
    prevSelected: selected,
    prevAvailable: availKey,
    open: findCategory(selected, availableMarkets) ?? 'results' as MarketCategoryKey | null,
  }))
  if (nav.prevSelected !== selected || nav.prevAvailable !== availKey) {
    setNav({ prevSelected: selected, prevAvailable: availKey, open: findCategory(selected, availableMarkets) ?? 'results' })
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
                <span aria-hidden="true" className="badge badge-accent" style={{ fontSize: '0.7rem' }}>{visible.length}</span>
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
                    {getMarketLabel(m, locale)}{analyst ? ` · ${m}` : ''}
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

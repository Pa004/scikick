import { useState } from 'react'
import { useLanguage, marketCategoryLabel } from '../i18n'
import { getMarketLabel } from '../utils/marketLabels'
import { MARKET_CATEGORIES, type MarketCategoryKey } from './marketCategories'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { Badge } from './ui/badge'

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

  const groups = (Object.entries(MARKET_CATEGORIES) as [MarketCategoryKey, string[]][])
    .map(([category, markets]) => ({
      category,
      visible: availableMarkets ? markets.filter(m => availableMarkets.includes(m)) : markets,
    }))
    .filter(g => g.visible.length > 0)

  return (
    <Accordion
      type="single"
      collapsible
      value={nav.open ?? ''}
      onValueChange={v => setNav(n => ({ ...n, open: (v || null) as MarketCategoryKey | null }))}
    >
      {groups.map(({ category, visible }) => (
        <AccordionItem key={category} value={category}>
          <AccordionTrigger>
            <span>{t(marketCategoryLabel(category))}</span>
            <span className="flex items-center gap-2">
              <Badge variant="accent" className="text-[0.65rem]" aria-hidden="true">
                {visible.length}
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-1.5">
              {visible.map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === selected}
                  onClick={() => onChange(m)}
                  className={
                    m === selected
                      ? 'min-h-9 cursor-pointer rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-fg shadow-sm transition-colors duration-150'
                      : 'min-h-9 cursor-pointer rounded-full border border-border px-3.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-foreground'
                  }
                >
                  {getMarketLabel(m, locale)}{analyst ? ` · ${m}` : ''}
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

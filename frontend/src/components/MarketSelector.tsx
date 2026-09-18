import { useState } from 'react'
import { useLanguage, marketCategoryLabel } from '../i18n'
import { getMarketLabel } from '../utils/marketLabels'
import { MARKET_CATEGORIES, type MarketCategoryKey } from './marketCategories'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { Badge } from './ui/badge'
import { Input } from './ui/input'

function groupOf(market: string, avail: string[] | undefined): MarketCategoryKey | null {
  for (const [category, markets] of Object.entries(MARKET_CATEGORIES) as [MarketCategoryKey, string[]][]) {
    if (markets.includes(market) && (!avail || avail.includes(market))) return category
  }
  return null
}

interface MarketSelectorProps {
  selected: string
  onChange: (market: string) => void
  availableMarkets?: string[]
  analyst?: boolean
  // In parallel layout the column is too narrow for the 2-col group grid.
  singleColumn?: boolean
  // Controlled search (e.g. rendered in the tab row above). When absent,
  // the selector owns its input and renders it inline.
  query?: string
  onQueryChange?: (q: string) => void
}



export default function MarketSelector({ selected, onChange, availableMarkets, analyst = false, singleColumn = false, query: controlledQuery, onQueryChange }: MarketSelectorProps) {
  const { t, locale } = useLanguage()
  const availKey = (availableMarkets ?? []).join('|')
  const [internalQuery, setInternalQuery] = useState('')
  const external = onQueryChange !== undefined
  const query = external ? (controlledQuery ?? '') : internalQuery
  const setQuery = external ? onQueryChange : setInternalQuery
  // Open the group holding the selection on mount so the chart has context.
  // Keep open groups when only the selection changes so the chart can be
  // compared live; reset only when the market set changes (other fixture).
  const [nav, setNav] = useState(() => {
    const initial = groupOf(selected, availableMarkets)
    return {
      prevSelected: selected,
      prevAvailable: availKey,
      open: initial ? [initial] : ([] as MarketCategoryKey[]),
    }
  })
  if (nav.prevAvailable !== availKey) {
    const reopen = groupOf(selected, availableMarkets)
    if (!external) setQuery('')
    setNav({ prevSelected: selected, prevAvailable: availKey, open: reopen ? [reopen] : [] })
  } else if (nav.prevSelected !== selected) {
    setNav(n => ({ ...n, prevSelected: selected }))
  }

  const q = query.trim().toLowerCase()
  const groups = (Object.entries(MARKET_CATEGORIES) as [MarketCategoryKey, string[]][])
    .map(([category, markets]) => ({
      category,
      visible: (availableMarkets ? markets.filter(m => availableMarkets.includes(m)) : markets)
        .filter(m => !q || getMarketLabel(m, locale).toLowerCase().includes(q)),
    }))
    .filter(g => g.visible.length > 0)
    // Pair similar heights to avoid large white-space when one card in a row expands.
    // Goles (10) is the outlier -> full width; remaining pair by count (5/5, 6/5, 4/3).
    .sort((a, b) => {
      if (a.category === 'goals') return -1
      if (b.category === 'goals') return 1
      return b.visible.length - a.visible.length
    })

  // While searching, every matching group stays open for scanning.
  const openValue = q ? groups.map(g => g.category) : nav.open

  return (
    <div>
      {!external && (
        <Input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('marketSearch')}
          aria-label={t('marketSearch')}
          className="mb-3"
        />
      )}
      {groups.length === 0 ? (
        <p className="m-0 text-sm text-faint">{t('noMarketMatch')}</p>
      ) : (
        <Accordion
          type="multiple"
          value={openValue}
          onValueChange={v => setNav(n => ({ ...n, open: v as MarketCategoryKey[] }))}
          className={singleColumn ? 'grid grid-cols-1 gap-3 md:items-start' : 'grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start'}
        >
          {groups.map(({ category, visible }) => (
            <AccordionItem
              key={category}
              value={category}
              className={category === 'goals' && !singleColumn ? 'md:col-span-2' : undefined}
            >
              <AccordionTrigger>
                <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                  {visible.includes(selected) && (
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className="truncate">{t(marketCategoryLabel(category))}</span>
                  {visible.includes(selected) && <span className="sr-only"> · {t('activeMarketGroup')}</span>}
                </span>
                <span className="flex w-12 shrink-0 items-center justify-center">
                  <Badge variant="accent" className="text-xs" aria-hidden="true">
                    {visible.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {visible.map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === selected}
                  onClick={() => onChange(m)}
                  className={
                    m === selected
                      ? 'min-h-11 cursor-pointer rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg shadow-sm transition-colors duration-150'
                      : 'min-h-11 cursor-pointer rounded-full border border-border px-4 text-sm font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-foreground'
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
      )}
    </div>
  )
}

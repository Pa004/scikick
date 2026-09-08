import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ScorerPlayer, ScorerPrediction } from '../types'
import { useLanguage, fillVars } from '../i18n'
import {
  filterScorers,
  sortScorers,
  DEFAULT_SORT_DIR,
  type ScorerSortKey,
  type SortDir,
  type TeamFilter,
} from '../utils/scorer'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { SegmentedButton, SegmentedGroup } from './ui/segmented'
import { Table, TableRegion, Td, Th } from './ui/table'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`
const VISIBLE_COUNT = 5

interface ScorerPanelProps {
  scorer: ScorerPrediction
}

const COLUMNS: { key: ScorerSortKey; labelKey: 'player' | 'team' | 'xg90' | 'min' | 'prob'; align: 'left' | 'center' | 'right' }[] = [
  { key: 'name', labelKey: 'player', align: 'left' },
  { key: 'team', labelKey: 'team', align: 'left' },
  { key: 'xg90', labelKey: 'xg90', align: 'center' },
  { key: 'min_expected', labelKey: 'min', align: 'center' },
  { key: 'prob_anytime', labelKey: 'prob', align: 'right' },
]

function ScorerControls({
  query, onQuery, team, onTeam,
}: {
  query: string; onQuery: (q: string) => void; team: TeamFilter; onTeam: (t: TeamFilter) => void
}) {
  const { t } = useLanguage()
  const filters: { value: TeamFilter; label: string }[] = [
    { value: 'both', label: t('teamAll') },
    { value: 'home', label: t('home') },
    { value: 'away', label: t('away') },
  ]
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Input
        type="search"
        value={query}
        onChange={e => onQuery(e.target.value)}
        placeholder={t('scorerSearch')}
        aria-label={t('scorerSearch')}
        className="min-w-40 flex-1"
      />
      <SegmentedGroup label={t('team')}>
        {filters.map(f => (
          <SegmentedButton key={f.value} active={team === f.value} onClick={() => onTeam(f.value)}>
            {f.label}
          </SegmentedButton>
        ))}
      </SegmentedGroup>
    </div>
  )
}

function probVariant(p: number): 'success' | 'warning' | 'neutral' {
  if (p > 0.3) return 'success'
  if (p > 0.15) return 'warning'
  return 'neutral'
}

function ScorerRow({ s }: { s: ScorerPlayer }) {
  return (
    <tr className="transition-colors hover:bg-surface-hover">
      <Td className="font-medium">
        {s.name}
        <span className="ml-1 text-xs text-faint">{s.position}</span>
      </Td>
      <Td className="text-muted">{s.team}</Td>
      <Td align="center">{typeof s.xg90 === 'number' ? s.xg90.toFixed(2) : '—'}</Td>
      <Td align="center">{typeof s.min_expected === 'number' ? `${s.min_expected.toFixed(0)}'` : '—'}</Td>
      <Td align="right">
        <Badge variant={probVariant(s.prob_anytime)}>{formatProb(s.prob_anytime)}</Badge>
      </Td>
    </tr>
  )
}

export default function ScorerPanel({ scorer }: ScorerPanelProps) {
  const { t } = useLanguage()
  const list = scorer.scorers ?? []
  const [sortKey, setSortKey] = useState<ScorerSortKey>('prob_anytime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [team, setTeam] = useState<TeamFilter>('both')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [fixtureId, setFixtureId] = useState(scorer.fixture_id)
  if (fixtureId !== scorer.fixture_id) {
    setFixtureId(scorer.fixture_id)
    setSortKey('prob_anytime')
    setSortDir('desc')
    setTeam('both')
    setQuery('')
    setExpanded(false)
  }

  const rows = useMemo(() => {
    const filtered = filterScorers(list, team, query)
    return sortScorers(filtered, sortKey, sortDir)
  }, [list, team, query, sortKey, sortDir])

  const visible = expanded ? rows : rows.slice(0, VISIBLE_COUNT)

  const handleSort = (key: ScorerSortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(DEFAULT_SORT_DIR[key])
    }
  }

  return (
    <div className="mt-4">
      <h3 className="mb-3 font-display text-base font-semibold text-foreground">{t('goalscorer')}</h3>

      <Badge
        variant={scorer.data_quality === 'lineup_confirmed' ? 'success' : 'warning'}
        className="mb-3 px-3 py-1 text-[0.8rem]"
      >
        {scorer.data_quality === 'lineup_confirmed' ? t('lineupConfirmed') : t('lineupProjected')}
      </Badge>

      {list.length === 0 ? (
        <p className="text-sm text-faint">{t('noScorerData')}</p>
      ) : (
        <>
          <ScorerControls query={query} onQuery={setQuery} team={team} onTeam={setTeam} />
          {rows.length === 0 ? (
            <p className="text-sm text-faint">{t('noScorerMatch')}</p>
          ) : (
            <Card>
              <TableRegion role="region" aria-label={t('goalscorer')} tabIndex={0} className="border-0">
                <Table>
                  <thead>
                    <tr>
                      {COLUMNS.map(col => (
                        <Th
                          key={col.key}
                          align={col.align}
                          aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            aria-label={`${t('sortBy')} ${t(col.labelKey)}${sortKey === col.key ? `, ${sortDir === 'asc' ? t('sortAsc') : t('sortDesc')}` : ''}`}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 bg-transparent p-1 font-medium text-inherit hover:text-foreground"
                          >
                            {t(col.labelKey)}
                            {sortKey === col.key && (
                              sortDir === 'asc'
                                ? <ArrowUp aria-hidden="true" className="size-3 text-primary-strong" />
                                : <ArrowDown aria-hidden="true" className="size-3 text-primary-strong" />
                            )}
                          </button>
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody id="scorer-tbody">
                    {visible.map(s => <ScorerRow key={s.player_id} s={s} />)}
                  </tbody>
                </Table>
              </TableRegion>
            </Card>
          )}
          <p aria-live="polite" className="my-2 text-xs text-faint">
            {fillVars(t('showingOf'), { shown: visible.length, total: rows.length })}
          </p>
          {rows.length > VISIBLE_COUNT && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls="scorer-tbody"
              className="w-full"
            >
              {expanded ? t('showLess') : `${t('showAll')} (${rows.length})`}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

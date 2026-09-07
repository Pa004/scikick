import { useMemo, useState } from 'react'
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
    <div className="scorer-controls">
      <input
        type="search"
        value={query}
        onChange={e => onQuery(e.target.value)}
        placeholder={t('scorerSearch')}
        aria-label={t('scorerSearch')}
        className="search-input"
      />
      <div role="group" aria-label={t('team')}>
        {filters.map(f => (
          <button
            key={f.value}
            type="button"
            aria-pressed={team === f.value}
            onClick={() => onTeam(f.value)}
            className="league-tab"
            style={team === f.value ? { background: 'var(--accent-gradient)', borderColor: 'transparent', color: '#fff' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ScorerRow({ s }: { s: ScorerPlayer }) {
  return (
    <tr>
      <td style={{ fontWeight: 500 }}>
        {s.name}
        <span style={{ color: 'var(--text-muted)', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
          {s.position}
        </span>
      </td>
      <td style={{ color: 'var(--text-secondary)' }}>{s.team}</td>
      <td style={{ textAlign: 'center' }}>{s.xg90.toFixed(2)}</td>
      <td style={{ textAlign: 'center' }}>{s.min_expected.toFixed(0)}'</td>
      <td style={{ textAlign: 'right', fontWeight: 500 }}>
        <span className={
          s.prob_anytime > 0.3 ? 'badge badge-success' :
          s.prob_anytime > 0.15 ? 'badge badge-warning' :
          'badge'
        } style={s.prob_anytime <= 0.15 ? { background: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-secondary)' } : undefined}>
          {formatProb(s.prob_anytime)}
        </span>
      </td>
    </tr>
  )
}

export default function ScorerPanel({ scorer }: ScorerPanelProps) {
  const { t } = useLanguage()
  const [sortKey, setSortKey] = useState<ScorerSortKey>('prob_anytime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [team, setTeam] = useState<TeamFilter>('both')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(() => {
    const filtered = filterScorers(scorer.scorers, team, query)
    return sortScorers(filtered, sortKey, sortDir)
  }, [scorer.scorers, team, query, sortKey, sortDir])

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
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('goalscorer')}</h2>

      <div
        className={scorer.data_quality === 'lineup_confirmed' ? 'badge badge-success' : 'badge badge-warning'}
        style={{ display: 'inline-block', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
      >
        {scorer.data_quality === 'lineup_confirmed'
          ? t('lineupConfirmed')
          : t('lineupProjected')}
      </div>

      {scorer.scorers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('noScorerData')}</p>
      ) : (
        <>
          <ScorerControls query={query} onQuery={setQuery} team={team} onTeam={setTeam} />
          {rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{t('noScorerMatch')}</p>
          ) : (
            <div className="card-flat" tabIndex={0} role="region" aria-label={t('goalscorer')} style={{ overflowX: 'auto', padding: '0.5rem' }}>
              <table className="table-dark">
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th key={col.key} scope="col" style={{ textAlign: col.align }} aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          aria-label={`${t('sortBy')} ${t(col.labelKey)}`}
                          className="th-sortable"
                        >
                          {t(col.labelKey)}
                          <span aria-hidden="true" className="sort-indicator">
                            {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody id="scorer-tbody">
                  {visible.map(s => <ScorerRow key={s.player_id} s={s} />)}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
            {fillVars(t('showingOf'), { shown: visible.length, total: rows.length })}
          </p>
          {rows.length > VISIBLE_COUNT && (
            <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="scorer-tbody" className="league-tab expander-btn">
              {expanded ? t('showLess') : `${t('showAll')} (${rows.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

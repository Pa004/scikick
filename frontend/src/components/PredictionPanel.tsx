import type { Fixture, Prediction } from '../types'
import { useLanguage } from '../i18n'
import { useDisplayMode, type DisplayMode } from '../hooks/useDisplayMode'
import { useMovement } from '../hooks/useMovement'
import { formatDecimal } from '../utils/odds'
import {
  getTeamForm,
  getHeadToHead,
  getMomentum,
  getSuperCombo,
  type FormOutcome,
} from '../utils/matchCenter'
import MarketRenderer from './MarketRenderer'
import MarketSelector from './MarketSelector'
import DisplayModeToggle from './DisplayModeToggle'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

function FormBadges({ form, emptyLabel }: { form: FormOutcome[]; emptyLabel: string }) {
  if (form.length === 0) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emptyLabel}</span>
  }
  return (
    <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
      {form.map((o, i) => (
        <span
          key={i}
          className={`badge form-badge ${o === 'W' ? 'badge-success' : o === 'D' ? 'badge-warning' : 'badge-danger'}`}
        >
          {o}
        </span>
      ))}
    </span>
  )
}

function MomentumRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="prob-bar" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="prob-bar-fill" style={{ width: `${pct}%` }} />
      <span style={{ fontWeight: 500, position: 'relative', zIndex: 1 }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function MatchCenter({ home, away, fixtures }: { home: string; away: string; fixtures: Fixture[] }) {
  const { t } = useLanguage()
  const homeForm = getTeamForm(fixtures, home)
  const awayForm = getTeamForm(fixtures, away)
  const h2h = getHeadToHead(home, away, fixtures)
  const momentum = getMomentum(homeForm, awayForm)

  return (
    <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>
        {t('matchCenter')}
      </h3>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        {t('form')} · {t('last5')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem' }}>{home}</span>
          <FormBadges form={homeForm} emptyLabel={t('noFormData')} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem' }}>{away}</span>
          <FormBadges form={awayForm} emptyLabel={t('noFormData')} />
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        {t('headToHead')}
      </div>
      {h2h.meetings.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>{t('noH2H')}</p>
      ) : (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {home} {h2h.homeWins} - {h2h.draws} - {h2h.awayWins} {away}
          </div>
          {h2h.meetings.map(m => (
            <div key={`${m.date}-${m.home}-${m.away}`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {m.date} · {m.home} {m.homeScore} - {m.awayScore} {m.away}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        {t('momentum')}
      </div>
      <MomentumRow label={home} pct={momentum.homePct} />
      <MomentumRow label={away} pct={momentum.awayPct} />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
        {t('basedOnLoaded')}
      </p>
    </div>
  )
}

function comboLegLabel(market: string, outcome: string, label: (key: 'home' | 'draw' | 'away' | 'over' | 'under') => string): string {
  if (market === '1x2') return label(outcome as 'home' | 'draw' | 'away')
  if (market === 'over_under_2.5') return `${label(outcome as 'over' | 'under')} 2.5`
  return outcome === 'yes' ? 'BTTS Yes' : 'BTTS No'
}

function comboMarketLabel(market: string): string {
  if (market === '1x2') return '1X2'
  if (market === 'over_under_2.5') return 'O/U 2.5'
  return 'BTTS'
}

function SuperCombo({ probabilities, mode }: { probabilities: Record<string, Record<string, number>>; mode: DisplayMode }) {
  const { t } = useLanguage()
  const combo = getSuperCombo(probabilities)
  const outcomeLabel = (key: 'home' | 'draw' | 'away' | 'over' | 'under') => {
    if (key === 'home') return t('home')
    if (key === 'draw') return t('draw')
    if (key === 'away') return t('away')
    return key === 'over' ? t('over') : t('under')
  }

  return (
    <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>
        {t('superCombo')}
      </h3>
      {combo.legs.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{t('superComboEmpty')}</p>
      ) : (
        <>
          <div className="combo-legs">
            {combo.legs.map(leg => (
              <div key={leg.market} className="card-flat" style={{ padding: '0.625rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {comboMarketLabel(leg.market)}
                </div>
                <div style={{ fontWeight: 600 }}>{comboLegLabel(leg.market, leg.outcome, outcomeLabel)}</div>
                <div style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {mode === 'odds' ? formatDecimal(leg.prob) : formatProb(leg.prob)}
                </div>
              </div>
            ))}
          </div>
          {combo.legs.length < 3 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
              {t('superComboPartial')}
            </p>
          )}
          {combo.estimate !== null && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              {t('superComboEstimate')}: {formatProb(combo.estimate)}
            </p>
          )}
        </>
      )}
    </div>
  )
}

interface PredictionPanelProps {
  prediction: Prediction
  selectedMarket: string
  onMarketChange: (market: string) => void
  home: string
  away: string
  fixtures: Fixture[]
}

export default function PredictionPanel({ prediction, selectedMarket, onMarketChange, home, away, fixtures }: PredictionPanelProps) {
  const { t } = useLanguage()
  const [mode, setMode] = useDisplayMode()
  const moves = useMovement(prediction.fixture_id, selectedMarket, prediction.probabilities[selectedMarket])
  const availableMarkets = Object.keys(prediction.probabilities)

  return (
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('prediction')}</h2>

      <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {t('model')}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{prediction.model_version}</span>
          {' | '}
          {t('agreement')}: <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{formatProb(prediction.model_agreement)}</span>
        </div>
        {prediction.probable_score && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('probableScore')}:{' '}
            <span
              className="badge badge-accent"
              style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem' }}
            >
              {prediction.probable_score.home} - {prediction.probable_score.away}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <MarketSelector selected={selectedMarket} onChange={onMarketChange} availableMarkets={availableMarkets} />
        </div>
        <DisplayModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>
          {selectedMarket.replace(/_/g, ' ')}
        </h3>
        <MarketRenderer market={selectedMarket} probabilities={prediction.probabilities} mode={mode} moves={moves} />
      </div>

      <MatchCenter home={home} away={away} fixtures={fixtures} />
      <SuperCombo probabilities={prediction.probabilities} mode={mode} />

      {prediction.top_features && prediction.top_features.length > 0 && (
        <div className="card-flat" style={{ padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>{t('topFeatures')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {prediction.top_features.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{f.feature.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{f.value.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

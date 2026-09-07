import { useEffect, useState } from 'react'
import { fetchValue } from '../api'
import type { ValueOutcome, ValueResponse } from '../types'
import { useLanguage } from '../i18n'

type Side = 'home' | 'draw' | 'away'

const SIDES: Side[] = ['home', 'draw', 'away']

function parseOdds(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(value) && value > 1 ? value : null
}

function OutcomeRow({ label, outcome }: { label: string; outcome: ValueOutcome }) {
  const { t } = useLanguage()
  const edgePct = `${outcome.edge >= 0 ? '+' : ''}${(outcome.edge * 100).toFixed(1)}%`
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
      <span style={{ flex: '1 1 auto', color: 'var(--text)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {(outcome.prob * 100).toFixed(1)}% · {outcome.odds.toFixed(2)}
      </span>
      <span className={outcome.value ? 'badge badge-accent' : 'badge'}>
        {outcome.value ? t('valueIsValue') : t('valueNoValue')} {edgePct}
      </span>
      {outcome.value && (
        <span style={{ color: 'var(--text-secondary)' }}>
          {t('valueKelly')} {(outcome.kelly * 100).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

export default function ValueChecker({
  fixtureId,
  home,
  away,
}: {
  fixtureId: number
  home: string
  away: string
}) {
  const { t } = useLanguage()
  const [odds, setOdds] = useState<Record<Side, string>>({ home: '', draw: '', away: '' })
  const [result, setResult] = useState<ValueResponse | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadAuto() {
      try {
        const data = await fetchValue(fixtureId)
        if (!cancelled) setResult(data)
      } catch {
        if (!cancelled) setResult(null)
      }
    }
    void loadAuto()
    return () => {
      cancelled = true
    }
  }, [fixtureId])

  const labels: Record<Side, string> = { home, draw: t('draw'), away }
  const parsed = {
    home: parseOdds(odds.home),
    draw: parseOdds(odds.draw),
    away: parseOdds(odds.away),
  }
  const ready = parsed.home !== null && parsed.draw !== null && parsed.away !== null

  async function check() {
    if (!ready || pending) return
    setPending(true)
    try {
      const data = await fetchValue(fixtureId, {
        home: parsed.home as number,
        draw: parsed.draw as number,
        away: parsed.away as number,
      })
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text)', fontSize: '1rem' }}>
        {t('valueTitle')}
      </h3>
      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {t('valueHint')}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {SIDES.map((side) => (
          <label key={side} style={{ flex: '1 1 90px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {labels[side]}
            <input
              type="number"
              min={1.01}
              step={0.01}
              value={odds[side]}
              onChange={(e) => {
                setOdds({ ...odds, [side]: e.target.value })
                setResult(null)
              }}
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>
        ))}
        <button type="button" onClick={() => void check()} disabled={!ready || pending}>
          {t('valueCheck')}
        </button>
      </div>
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {SIDES.map((side) => (
            <OutcomeRow key={side} label={labels[side]} outcome={result.outcomes[side]} />
          ))}
        </div>
      )}
    </div>
  )
}

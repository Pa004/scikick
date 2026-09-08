import { useEffect, useState } from 'react'
import { fetchValue } from '../api'
import type { ValueOutcome, ValueResponse } from '../types'
import { useLanguage } from '../i18n'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardBody, CardTitle } from './ui/card'
import { Input } from './ui/input'

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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="flex-1 basis-24 text-foreground">{label}</span>
      <span className="text-muted tabular-nums">
        {(outcome.prob * 100).toFixed(1)}% · {outcome.odds.toFixed(2)}
      </span>
      <Badge variant={outcome.value ? 'accent' : 'neutral'}>
        {outcome.value ? t('valueIsValue') : t('valueNoValue')} · {t('valueEdge')} {edgePct}
      </Badge>
      {outcome.value && (
        <span className="text-muted tabular-nums">
          {t('valueKelly')} {(outcome.kelly * 100).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

interface ValueCheckerProps {
  fixtureId: number
  home: string
  away: string
  // Prefetched stored odds (match story bundle). When undefined the
  // checker loads them itself; provided null means "no stored odds".
  autoResult?: ValueResponse | null
}

export default function ValueChecker({
  fixtureId,
  home,
  away,
  autoResult,
}: ValueCheckerProps) {
  const { t } = useLanguage()
  const [odds, setOdds] = useState<Record<Side, string>>({ home: '', draw: '', away: '' })
  const [result, setResult] = useState<ValueResponse | null>(autoResult ?? null)
  const [pending, setPending] = useState(false)
  const [autoError, setAutoError] = useState(false)

  useEffect(() => {
    setOdds({ home: '', draw: '', away: '' })
    setAutoError(false)
    if (autoResult !== undefined) {
      setResult(autoResult)
      return
    }
    let cancelled = false
    setResult(null)
    async function loadAuto() {
      try {
        const data = await fetchValue(fixtureId)
        if (!cancelled) setResult(data)
      } catch {
        if (!cancelled) {
          setResult(null)
          setAutoError(true)
        }
      }
    }
    void loadAuto()
    return () => {
      cancelled = true
    }
    // autoResult is set once per mount (bundle already loaded when rendered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Card className="mb-4">
      <CardBody>
        <CardTitle className="mb-1">{t('valueTitle')}</CardTitle>
        <p id="value-hint" className="mt-0 mb-3 text-xs text-muted">
          {t('valueHint')}
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          {SIDES.map((side) => (
            <label key={side} className="min-w-22 flex-1 text-xs text-muted">
              <span className="mb-1 block font-medium">{labels[side]}</span>
              <Input
                type="number"
                inputMode="decimal"
                min={1.01}
                step={0.01}
                value={odds[side]}
                onChange={(e) => {
                  setOdds({ ...odds, [side]: e.target.value })
                }}
              />
            </label>
          ))}
          <Button type="button" variant="primary" onClick={() => void check()} disabled={!ready || pending} aria-describedby="value-hint">
            {pending ? t('loading') : t('valueCheck')}
          </Button>
        </div>
        <div role="status" aria-live="polite" className="border-t border-border pt-3">
          {result ? (
            <div className="flex flex-col gap-2">
              {SIDES.map((side) => result.outcomes[side] && (
                <OutcomeRow key={side} label={labels[side]} outcome={result.outcomes[side]} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-faint">
              {autoError ? t('valueAutoFailed') : t('valueEmpty')}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

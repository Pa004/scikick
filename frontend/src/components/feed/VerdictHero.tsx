import type { Fixture } from '../../types'
import { useLanguage } from '../../i18n'
import type { OutcomeProbs } from '../../utils/matchCenter'
import { fixtureVerdict } from '../fixtures/fixtureUtils'
import { getVerdict, formatFrequency } from '../../utils/verdict'
import { Dots10 } from '../fixtures/Dots10'
import { Badge } from '../ui/badge'

interface VerdictHeroProps {
  fixture: Fixture
  probableScore: { home: number; away: number } | null
  // Fresh bundle probabilities win over the feed-embedded snapshot,
  // which may be missing or stale.
  probs?: OutcomeProbs | null
}

// The story lede: one big natural-language sentence plus the frequency
// made visible. Everything below is evidence for this claim.
export function VerdictHero({ fixture, probableScore, probs }: VerdictHeroProps) {
  const { t } = useLanguage()
  const embedded = fixtureVerdict(fixture)
  const v = probs
    ? (() => {
        const fresh = getVerdict(fixture.home, fixture.away, probs)
        return { outcome: fresh.outcome, teamLabel: fresh.teamLabel, frequency: formatFrequency(fresh.prob) }
      })()
    : embedded
  if (!v) return null
  const n = String(v.frequency)
  const text =
    v.outcome === 'draw'
      ? t('verdictDraw').replace('{n}', n)
      : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', n)

  return (
    <div className="mb-4">
      <p className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">
        {text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Dots10 filled={v.frequency} label={text} />
        {probableScore && (
          <span className="text-sm text-muted">
            {t('probableScore')}{' '}
            <Badge variant="accent" className="px-3 py-1 font-mono text-sm tabular-nums">
              {probableScore.home} - {probableScore.away}
            </Badge>
          </span>
        )}
      </div>
    </div>
  )
}

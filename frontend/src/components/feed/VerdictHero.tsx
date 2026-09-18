import type { Fixture } from '../../types'
import { useLanguage } from '../../i18n'
import type { OutcomeProbs } from '../../utils/matchCenter'
import { fixtureVerdict } from '../fixtures/fixtureUtils'
import { getVerdict, formatFrequency } from '../../utils/verdict'
import { displayTeam } from '../../utils/teamNames'
import { Dots10 } from '../fixtures/Dots10'
import { Badge } from '../ui/badge'

interface VerdictHeroProps {
  fixture: Fixture
  probableScore: { home: number; away: number } | null
  // Fresh bundle probabilities win over the feed-embedded snapshot,
  // which may be missing or stale.
  probs?: OutcomeProbs | null
  // Analysts always see the probable score; lay users only when it agrees
  // with the verdict (a contradicting scoreline destroys trust in the lede).
  analyst?: boolean
}

// The most likely exact score can disagree with the most likely outcome
// (e.g. 1-1 tops scores while home wins the 1X2). Only show it alongside
// the verdict when both point the same way.
export function scoreMatchesVerdict(
  outcome: 'home' | 'draw' | 'away',
  score: { home: number; away: number },
): boolean {
  if (outcome === 'draw') return score.home === score.away
  if (outcome === 'home') return score.home > score.away
  return score.home < score.away
}

// The story lede: one big natural-language sentence plus the frequency
// made visible. Everything below is evidence for this claim.
export function VerdictHero({ fixture, probableScore, probs, analyst = false }: VerdictHeroProps) {
  const { t } = useLanguage()
  const embedded = fixtureVerdict(fixture)
  const v = probs
    ? (() => {
        const fresh = getVerdict(fixture.home, fixture.away, probs)
        return { outcome: fresh.outcome, teamLabel: displayTeam(fresh.teamLabel), frequency: formatFrequency(fresh.prob) }
      })()
    : embedded
  if (!v) return null
  const n = String(v.frequency)
  const text =
    v.outcome === 'draw'
      ? t('verdictDraw').replace('{n}', n)
      : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', n)

  return (
    <div className="mb-4 rounded-xl border border-border bg-primary-soft px-4 py-4">
      <p className="text-xs font-extrabold tracking-[0.08em] text-primary-ink uppercase">
        {t('verdictKicker')}
      </p>
      <p className="mt-1.5 font-display text-[26px] leading-tight font-bold text-balance text-foreground sm:text-[30px]">
        {text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Dots10 filled={v.frequency} label={text} />
        {probableScore && (analyst || scoreMatchesVerdict(v.outcome, probableScore)) && (
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

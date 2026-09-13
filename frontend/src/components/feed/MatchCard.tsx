import { useState } from 'react'
import { ArrowLeft, ChevronDown, Star } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage, fillVars } from '../../i18n'
import { extract1x2, asOutcomeProbs, getTeamForm, type FormOutcome } from '../../utils/matchCenter'
import { formatHumanDate } from '../fixtures/fixtureUtils'
import { useFixtureDetail } from '../../hooks/useFixtureDetail'
import { SegmentedBar } from './SegmentedBar'
import { VerdictHero } from './VerdictHero'
import { TeamAvatar } from './TeamAvatar'
import { displayTeam } from '../../utils/teamNames'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../lib/cn'
import PredictionPanel from '../PredictionPanel'
import ScorerPanel from '../ScorerPanel'

interface MatchCardProps {
  fixture: Fixture
  expanded: boolean
  onToggle: () => void
  leagueName: string
  followed: string[]
  onToggleFollow: (team: string) => void
  hasValue: boolean | null
  analyst: boolean
  fixtures: Fixture[]
}

function FollowStar({
  team,
  followed,
  onToggle,
}: {
  team: string
  followed: string[]
  onToggle: () => void
}) {
  const { t } = useLanguage()
  const active = followed.includes(team)
  const label = fillVars(active ? t('unfollowTeam') : t('followTeam'), { team: displayTeam(team) })
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors',
        active ? 'text-primary-strong' : 'text-faint hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <Star aria-hidden="true" className="size-5" fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}

function FormStrip({ form, label }: { form: FormOutcome[]; label: string }) {
  if (form.length === 0) return null
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {form.map((o, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'h-1.5 w-4 rounded-full',
            o === 'W' ? 'bg-success' : o === 'D' ? 'bg-warning' : 'bg-danger/60',
          )}
        />
      ))}
    </span>
  )
}

export function MatchCard({
  fixture: f,
  expanded,
  onToggle,
  leagueName,
  followed,
  onToggleFollow,
  hasValue,
  analyst,
  fixtures,
}: MatchCardProps) {
  const { t, locale } = useLanguage()
  const [market, setMarket] = useState('1x2')
  const detail = useFixtureDetail(expanded ? f : null)
  const probs = extract1x2(f.prediction)
  const storyId = `story-${f.id}`

  return (
    <article
      id={`match-card-${f.id}`}
      aria-labelledby={`match-title-${f.id}`}
      className={cn(
        'animate-fade scroll-mt-24 rounded-xl border bg-surface shadow-sm transition-colors',
        expanded ? 'border-primary/40 shadow-md' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start gap-1 p-4 pb-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={storyId}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left"
        >
          <span className="block text-xs font-medium text-faint">
            {formatHumanDate(f.date, locale)} · {leagueName}
          </span>
          <h2 id={`match-title-${f.id}`} className="mt-1 flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-foreground">
            <TeamAvatar team={f.home} crest={f.home_crest} />
            <span className="min-w-0 flex-1 truncate" title={`${displayTeam(f.home)} vs ${displayTeam(f.away)}`}>
              {displayTeam(f.home)} vs {displayTeam(f.away)}
              {f.home_score !== null && (
                <span className="ml-2 font-mono text-base font-medium text-muted tabular-nums">
                  {f.home_score} - {f.away_score}
                </span>
              )}
            </span>
            <TeamAvatar team={f.away} crest={f.away_crest} />
          </h2>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            {f.prediction != null && (
              <Badge variant="accent" className="text-xs">
                {t('predicted')}
              </Badge>
            )}
            {hasValue === true && (
              <Badge variant="success" className="text-xs">
                {t('valueIsValue')}
              </Badge>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center" role="group" aria-label={t('myMatches')}>
          <FollowStar
            team={f.home}
            followed={followed}
            onToggle={() => onToggleFollow(f.home)}
          />
          <FollowStar
            team={f.away}
            followed={followed}
            onToggle={() => onToggleFollow(f.away)}
          />
        </div>
        <span aria-hidden="true" className="flex min-h-11 min-w-8 items-center justify-center text-faint">
          <ChevronDown
            className={cn('size-5 transition-transform duration-200', expanded && 'rotate-180')}
          />
        </span>
      </div>

      {probs && (
        <div className="space-y-2 px-4 pb-3">
          <SegmentedBar
            probs={probs}
            home={f.home}
            away={f.away}
            onSelect={() => {
              setMarket('1x2')
              if (!expanded) onToggle()
            }}
          />
          {!expanded && (
            <div className="flex items-center justify-between gap-2">
              <FormStrip form={getTeamForm(fixtures, f.home)} label={`${displayTeam(f.home)}: ${t('form')}`} />
              <FormStrip form={getTeamForm(fixtures, f.away)} label={`${displayTeam(f.away)}: ${t('form')}`} />
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div role="region" aria-label={`${displayTeam(f.home)} vs ${displayTeam(f.away)}`} id={storyId} className="animate-fade border-t border-border px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-label={t('backToFeed')}
              title={t('backToFeed')}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
            <span className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">
              {formatHumanDate(f.date, locale)} · {leagueName}
            </span>
          </div>
          {detail.loading && (
            <div role="status" aria-label={t('loadingMatch')} className="flex flex-col gap-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {detail.error && (
            <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
              <p className="mb-2">{t('matchError')}</p>
              <Button type="button" size="sm" variant="secondary" onClick={detail.retry}>
                {t('retry')}
              </Button>
            </div>
          )}
          {detail.data && (
            <>
              <VerdictHero
                fixture={f}
                probableScore={detail.data.prediction.probable_score}
                probs={asOutcomeProbs(detail.data.prediction.probabilities['1x2'])}
              />
              <PredictionPanel
                prediction={detail.data.prediction}
                selectedMarket={market}
                onMarketChange={setMarket}
                home={f.home}
                away={f.away}
                fixtures={fixtures}
                analyst={analyst}
                bare
                initialValue={detail.data.value}
              />
              {detail.data.scorer ? (
                <ScorerPanel key={detail.data.scorer.fixture_id} scorer={detail.data.scorer} />
              ) : (
                <p className="mt-4 text-sm text-faint">{t('noScorerData')}</p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}

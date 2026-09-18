import { useState } from 'react'
import { ArrowLeft, Star } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage, fillVars } from '../../i18n'
import { extract1x2, asOutcomeProbs, type FormOutcome } from '../../utils/matchCenter'
import { formLetter } from '../../utils/form'
import { fixtureVerdict } from '../fixtures/fixtureUtils'
import { getVerdict, formatFrequency } from '../../utils/verdict'
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
import type { DisplayMode } from '../../hooks/useDisplayMode'

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
  hideDate?: boolean
  hideLeague?: boolean
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
  marketLayout?: 'stack' | 'parallel'
  storyTabs?: boolean
}

export function FollowStar({
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

export function FormStrip({ form, label }: { form: FormOutcome[]; label: string }) {
  const { locale } = useLanguage()
  const letter = (o: FormOutcome) => formLetter(o, locale)
  if (form.length === 0) return null
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={label}>
      {form.map((o, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-[13px] font-extrabold',
            o === 'W'
              ? 'border-primary bg-primary-soft text-primary-ink'
              : o === 'D'
                ? 'border-border bg-surface-alt text-muted'
                : 'border-danger/50 bg-danger-soft text-danger-ink',
          )}
        >
          {letter(o)}
        </span>
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
  hideDate = false,
  hideLeague = false,
  displayMode,
  onDisplayModeChange,
  marketLayout = 'stack',
  storyTabs = false,
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
        'animate-fade scroll-mt-24 rounded-[14px] border bg-surface transition-colors',
        expanded ? 'border-foreground shadow-md' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start gap-2 p-4 pb-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={storyId}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left"
        >
          {(!hideLeague || !hideDate) && (
            <span className="flex items-baseline justify-between gap-2">
              {!hideLeague && (
                <span className="text-xs font-bold tracking-[0.08em] text-faint uppercase">
                  {leagueName}
                </span>
              )}
              {!hideDate && (
                <span className="font-mono text-[13px] text-muted tabular-nums">
                  {formatHumanDate(f.date, locale)}
                </span>
              )}
            </span>
          )}
          <h2 id={`match-title-${f.id}`} className="flex min-w-0 flex-wrap items-center gap-2 text-[17px] leading-snug font-bold text-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <TeamAvatar team={f.home} crest={f.home_crest} />
              <span className="min-w-0 truncate" title={displayTeam(f.home)}>
                {displayTeam(f.home)}
              </span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <span>vs</span>
              <span className="min-w-0 truncate" title={displayTeam(f.away)}>
                {displayTeam(f.away)}
              </span>
              <TeamAvatar team={f.away} crest={f.away_crest} />
            </span>
            {f.home_score !== null && (
              <span className="ml-1 font-mono text-[15px] font-medium text-muted tabular-nums">
                {f.home_score} - {f.away_score}
              </span>
            )}
          </h2>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            {f.prediction != null && (
              <Badge variant="accent" className="text-xs">
                {t('predicted')}
              </Badge>
            )}
            {hasValue === true && (
              <Badge variant="value" className="text-xs" title="Valor esperado positivo: cuota con valor">
                {t('valueIsValue')}
              </Badge>
            )}
          </span>
        </button>
        <div className="ml-2 flex shrink-0 items-center pl-2" role="group" aria-label={t('myMatches')}>
          {(() => {
            const isFollowed = followed.includes(f.home) || followed.includes(f.away)
            const label = isFollowed ? t('unfollowMatch') : t('followMatch')
            const handleToggle = (e: React.MouseEvent) => {
              e.stopPropagation()
              if (isFollowed) {
                if (followed.includes(f.home)) onToggleFollow(f.home)
                if (followed.includes(f.away)) onToggleFollow(f.away)
              } else {
                onToggleFollow(f.home)
              }
            }
            return (
              <button
                type="button"
                onClick={handleToggle}
                aria-pressed={isFollowed}
                aria-label={label}
                title={label}
                className={cn(
                  'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors',
                  isFollowed ? 'text-primary-strong' : 'text-faint hover:bg-surface-hover hover:text-foreground',
                )}
              >
                <Star aria-hidden="true" className="size-5" fill={isFollowed ? 'currentColor' : 'none'} />
              </button>
            )
          })()}
        </div>
      </div>

      {probs && !expanded && (
        <div className="px-4 pb-3">
          {(() => {
            const embedded = fixtureVerdict(f)
            const v = embedded ?? (() => {
              const fresh = getVerdict(f.home, f.away, probs)
              return { outcome: fresh.outcome, teamLabel: displayTeam(fresh.teamLabel), frequency: formatFrequency(fresh.prob) }
            })()
            const verdictText = v
              ? v.outcome === 'draw'
                ? t('verdictDraw').replace('{n}', String(v.frequency))
                : t('verdictWin').replace('{team}', v.teamLabel).replace('{n}', String(v.frequency))
              : null
            const homePct = Math.round(probs.home * 100)
            const drawPct = Math.round(probs.draw * 100)
            const awayPct = Math.round(probs.away * 100)
            return (
              <>
                {verdictText && <p className="text-[15px] font-semibold leading-snug text-foreground">{verdictText}</p>}
                <div className="mt-2">
                  <SegmentedBar compact probs={probs} home={f.home} away={f.away} onSelect={onToggle} />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  <span className="font-mono tabular-nums">{displayTeam(f.home)} {homePct}%</span>
                  <span className="mx-1.5 text-faint">·</span>
                  <span className="font-mono tabular-nums">{t('draw')} {drawPct}%</span>
                  <span className="mx-1.5 text-faint">·</span>
                  <span className="font-mono tabular-nums">{displayTeam(f.away)} {awayPct}%</span>
                  <span className="ml-2 text-xs font-normal text-faint">{locale === 'es' ? '· suman 100' : '· sums to 100'}</span>
                </p>
              </>
            )
          })()}
        </div>
      )}

      {probs && expanded && (
        <div className="px-4 pb-4">
          <SegmentedBar
            probs={probs}
            home={f.home}
            away={f.away}
            onSelect={() => {
              setMarket('1x2')
              if (!expanded) onToggle()
            }}
          />
        </div>
      )}

      {expanded && (
        <div role="region" aria-label={`${displayTeam(f.home)} vs ${displayTeam(f.away)}`} id={storyId} className="animate-fade border-t border-border px-4 py-4">
          {!hideDate && (
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
            </div>
          )}
          {detail.loading && (
            <div role="status" aria-label={t('loadingMatch')} className="flex flex-col gap-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {detail.error && (
            <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
              <p className="mb-2">{t('matchError')}</p>
              <Button type="button" size="sm" variant="secondary" onClick={detail.retry}>
                {t('retry')}
              </Button>
            </div>
          )}
          {detail.data && (
            <>
              <div id={`${storyId}-verdict`} className="scroll-mt-[200px]">
                <VerdictHero
                  fixture={f}
                  probableScore={detail.data.prediction.probable_score}
                  probs={asOutcomeProbs(detail.data.prediction.probabilities['1x2'])}
                  analyst={analyst}
                />
              </div>
              <div id={`${storyId}-markets`} className="scroll-mt-[200px]">
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
                  displayMode={displayMode}
                  onDisplayModeChange={onDisplayModeChange}
                  marketLayout={marketLayout}
                  storyTabs={storyTabs}
                  contextHome={detail.data.contextHome}
                  contextAway={detail.data.contextAway}
                />
              </div>
              <div id={`${storyId}-scorers`} className="scroll-mt-[200px]">
                {detail.data.scorer ? (
                  <ScorerPanel key={detail.data.scorer.fixture_id} scorer={detail.data.scorer} />
                ) : (
                  <p className="mt-4 text-sm text-faint">{t('noScorerData')}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

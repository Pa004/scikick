import { ArrowLeft } from 'lucide-react'
import type { Fixture } from '../../types'
import { useLanguage } from '../../i18n'
import { asOutcomeProbs } from '../../utils/matchCenter'
import type { DisplayMode } from '../../hooks/useDisplayMode'
import type { useFixtureDetail } from '../../hooks/useFixtureDetail'
import { useFeed } from './FeedContext'
import { VerdictHero } from './VerdictHero'
import PredictionPanel from '../PredictionPanel'
import ScorerPanel from '../ScorerPanel'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'

interface MatchStoryExpandedProps {
  fixture: Fixture
  storyId: string
  detail: ReturnType<typeof useFixtureDetail>
  market: string
  onMarketChange: (market: string) => void
  onToggle: () => void
  fixtures: Fixture[]
  hideDate: boolean
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
  marketLayout?: 'stack' | 'parallel'
  storyTabs?: boolean
}

export function MatchStoryExpanded({
  fixture: f,
  storyId,
  detail,
  market,
  onMarketChange,
  onToggle,
  fixtures,
  hideDate,
  displayMode,
  onDisplayModeChange,
  marketLayout = 'stack',
  storyTabs = false,
}: MatchStoryExpandedProps) {
  const { t } = useLanguage()
  const { analyst } = useFeed()
  return (
    <>
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
              onMarketChange={onMarketChange}
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
    </>
  )
}

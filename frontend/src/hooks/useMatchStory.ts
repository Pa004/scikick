import { useState } from 'react'
import type { Fixture } from '../types'
import { extract1x2 } from '../utils/matchCenter'
import { useFixtureDetail } from './useFixtureDetail'

// Story state for one match card: detail bundle (only while expanded),
// headline 1X2 probabilities and the selected market.
export function useMatchStory(fixture: Fixture, expanded: boolean) {
  const [market, setMarket] = useState('1x2')
  const detail = useFixtureDetail(expanded ? fixture : null)
  const probs = extract1x2(fixture.prediction)
  const storyId = `story-${fixture.id}`
  return { detail, probs, storyId, market, setMarket }
}

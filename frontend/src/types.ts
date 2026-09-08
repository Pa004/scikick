export interface Fixture {
  id: number
  date: string
  home: string
  away: string
  home_crest?: string | null
  away_crest?: string | null
  status: string
  home_score: number | null
  away_score: number | null
  prediction: Record<string, unknown> | null
  league: string
}

export interface Prediction {
  fixture_id: number
  model_version: string
  model_agreement: number
  probabilities: Record<string, Record<string, number>>
  probable_score: { home: number; away: number } | null
  top_features: { feature: string; value: number; shap_importance: number }[] | null
}

export interface ValueOutcome {
  prob: number
  odds: number
  edge: number
  value: boolean
  kelly: number
}

export interface ValueResponse {
  fixture_id: number
  outcomes: Record<string, ValueOutcome>
}

export interface ContextFormEntry {
  date: string
  opponent: string
  result: 'W' | 'D' | 'L'
  score: string
}

export interface ContextH2HMeeting {
  date: string
  home: string
  away: string
  score: string
}

export interface TeamContext {
  team: string
  crest?: string | null
  form: ContextFormEntry[]
  opponent?: string
  opponent_crest?: string | null
  h2h?: { wins: number; draws: number; losses: number; matches: ContextH2HMeeting[] }
}

export interface ConfidenceBand {
  band: string
  total: number
  hits: number
  accuracy: number
}

export interface LeagueStats {
  league: string
  total: number
  hits: number
  accuracy: number
}

export interface MarketStats {
  market: string
  total: number
  hits: number
  accuracy: number
  cold_start: boolean
}

export interface Stats {
  total_predictions: number
  accuracy: number
  avg_confidence: number
  by_confidence_band: ConfidenceBand[]
  by_league: LeagueStats[]
  by_market: MarketStats[]
  cold_start: boolean
}

export interface MatchdayStats {
  matchday: string
  total: number
  hits: number
  accuracy: number
  brier: number
}

export interface MatchdayData {
  market: string
  league: string | null
  cold_start: boolean
  data: MatchdayStats[]
}

export interface CalibrationBin {
  bin_center: number
  avg_predicted: number
  actual_accuracy: number
  count: number
}

export interface CalibrationData {
  market: string
  league: string | null
  cold_start: boolean
  data: CalibrationBin[]
}

export interface ScorerPlayer {
  player_id: number
  name: string
  team: string
  position: string
  xg90: number
  min_expected: number
  prob_anytime: number
  home_away: string
  projected?: boolean
}

export interface ScorerPrediction {
  fixture_id: number
  data_quality: string
  scorers: ScorerPlayer[]
}

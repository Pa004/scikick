export interface Fixture {
  id: number
  date: string
  home: string
  away: string
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
